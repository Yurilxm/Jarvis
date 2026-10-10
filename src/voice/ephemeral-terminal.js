import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { readVoiceConfig } from "./config.js";

const SESSION_DIR = path.join(os.homedir(), ".jarvis-dev", "voice-sessions");

let currentSession = null;

function generateSessionId() {
  return "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}

function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function hasWindowsTerminal() {
  try {
    const res = spawnSync("where", ["wt.exe"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

function buildTailScript(logFile) {
  const safeLog = String(logFile).replace(/'/g, "''");
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "Write-Host ''",
    "Write-Host '  Jarvis Voz - sessao ativa' -ForegroundColor Cyan",
    "Write-Host '  (esta janela fecha quando a sessao encerrar)' -ForegroundColor DarkGray",
    "Write-Host ''",
    "Get-Content -LiteralPath '" + safeLog + "' -Wait -Tail 0 | ForEach-Object {",
    "  if ($_ -eq '__CLOSE_SESSION__') { break }",
    "  Write-Host $_",
    "}",
    "Write-Host ''",
    "Write-Host '  Sessao encerrada.' -ForegroundColor DarkGray",
    "Start-Sleep -Milliseconds 800",
  ].join("; ");
}

/**
 * Gera um wrapper .vbs que abre o PowerShell minimizado de forma confiavel.
 * VBS e' o unico jeito 100% garantido de controlar o windowStyle no Windows,
 * inclusive quando o processo pai esta rodando em background (sem console).
 *
 * @param {string} psScriptPath
 * @returns {string} caminho do .vbs
 */
function buildVbsWrapper(psScriptPath) {
  const vbsPath = psScriptPath.replace(/\.ps1$/i, ".vbs");
  const safePs = String(psScriptPath).replace(/"/g, '""');
  // Em VBS, dentro de string dupla, "" e' uma aspa. Nao existe escape tipo \".
  // Montamos a linha com & (concatenacao) pra nao depender de escape.
  const cmdLine = [
    "cmd = \"powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File \"",
    " & Chr(34) & \"" + safePs + "\" & Chr(34)",
  ].join("");
  const content = [
    "' Jarvis Voz - wrapper de terminal de sessao",
    "' Roda o script PowerShell minimizado e destaca do processo pai.",
    "Set WshShell = CreateObject(\"WScript.Shell\")",
    cmdLine,
    "' 7 = minimized, False = nao esperar pelo processo",
    "WshShell.Run cmd, 7, False",
  ].join("\r\n");
  fs.writeFileSync(vbsPath, content, "utf-8");
  return vbsPath;
}

function spawnTerminalWindow(psScriptPath) {
  const cfg = readVoiceConfig();
  const pref = (cfg.terminalPreference || "wt").toLowerCase();

  // 1. VBS wrapper (default) - abre PowerShell minimizado de forma confiavel
  if (pref === "vbs") {
    try {
      const vbsPath = buildVbsWrapper(psScriptPath);
      const child = spawn(
        "wscript.exe",
        [vbsPath],
        { detached: true, stdio: "ignore", windowsHide: true }
      );
      child.unref();
      return { ok: true, method: "vbs-minimized", pid: child.pid };
    } catch (err) {
      // cai pro WT se VBS falhar
    }
  }

  // 2. Windows Terminal (opt-in via terminalPreference: "wt")
  if ((pref === "wt" || pref === "vbs") && hasWindowsTerminal()) {
    try {
      const child = spawn(
        "wt.exe",
        ["-w", "-1", "nt", "powershell.exe", "-NoLogo", "-NoProfile", "-File", psScriptPath],
        { detached: true, stdio: "ignore", windowsHide: false }
      );
      child.unref();
      return { ok: true, method: "wt-minimized", pid: child.pid };
    } catch {
      // cai pro powershell direto
    }
  }

  // 3. Fallback final: PowerShell direto
  try {
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-WindowStyle", "Minimized", "-File", psScriptPath],
      { detached: true, stdio: "ignore", windowsHide: false }
    );
    child.unref();
    return { ok: true, method: "powershell-minimized", pid: child.pid };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export function openSessionTerminal() {
  if (process.platform !== "win32") {
    return { ok: false, reason: "Session terminal so disponivel no Windows." };
  }
  if (currentSession) {
    return { ok: true, sessionId: currentSession.id, logFile: currentSession.logFile, pid: currentSession.pid };
  }

  ensureSessionDir();

  const id = generateSessionId();
  const logFile = path.join(SESSION_DIR, id + ".log");
  const psScriptPath = path.join(SESSION_DIR, id + ".ps1");

  try {
    // Cria o log vazio (o tail precisa dele pra existir)
    fs.writeFileSync(logFile, "", "utf-8");
    // Cria o script .ps1 que o PowerShell vai rodar
    fs.writeFileSync(psScriptPath, buildTailScript(logFile), "utf-8");
  } catch (err) {
    return { ok: false, reason: "Falha ao criar arquivos de sessao: " + err.message };
  }

  const opened = spawnTerminalWindow(psScriptPath);
  if (!opened.ok) {
    try { fs.unlinkSync(logFile); } catch { /* ignore */ }
    try { fs.unlinkSync(psScriptPath); } catch { /* ignore */ }
    return { ok: false, reason: opened.reason || "Falha ao abrir janela." };
  }

  currentSession = {
    id,
    logFile,
    psScriptPath,
    pid: opened.pid,
    method: opened.method,
    startedAt: Date.now(),
    lineCount: 0,
  };

  return { ok: true, sessionId: id, logFile, psScriptPath, pid: opened.pid, method: opened.method };
}

export function isSessionOpen() {
  return currentSession !== null;
}

export function appendToTerminal(content) {
  if (!currentSession) return false;
  const text = Array.isArray(content) ? content.join("\n") : String(content);
  if (!text) return true;

  try {
    fs.appendFileSync(currentSession.logFile, text + "\n", "utf-8");
    currentSession.lineCount += 1;
    return true;
  } catch {
    return false;
  }
}

export function closeSessionTerminal() {
  if (!currentSession) return false;

  const { logFile, psScriptPath } = currentSession;

  try {
    fs.appendFileSync(logFile, "__CLOSE_SESSION__\n", "utf-8");
  } catch {
    // ignora
  }

  setTimeout(() => {
    try { fs.unlinkSync(logFile); } catch { /* ignore */ }
    try { if (psScriptPath) fs.unlinkSync(psScriptPath); } catch { /* ignore */ }
  }, 5000).unref();

  currentSession = null;
  return true;
}

export function cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    if (!fs.existsSync(SESSION_DIR)) return;
    const now = Date.now();
    const entries = fs.readdirSync(SESSION_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".log") && !entry.name.endsWith(".ps1") && !entry.name.endsWith(".vbs")) continue;
      const full = path.join(SESSION_DIR, entry.name);
      try {
        const stat = fs.statSync(full);
        if (now - stat.mtimeMs > maxAgeMs) fs.unlinkSync(full);
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
