import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";

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

function spawnTerminalWindow(logFile) {
  const script = buildTailScript(logFile);

  if (hasWindowsTerminal()) {
    try {
      const child = spawn(
        "wt.exe",
        ["-w", "-1", "nt", "powershell.exe", "-NoLogo", "-NoProfile", "-Command", script],
        { detached: true, stdio: "ignore", windowsHide: true }
      );
      child.unref();
      return { ok: true, method: "wt-minimized", pid: child.pid };
    } catch {
      // cai pro powershell direto
    }
  }

  try {
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-WindowStyle", "Minimized", "-Command", script],
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

  try {
    fs.writeFileSync(logFile, "", "utf-8");
  } catch (err) {
    return { ok: false, reason: "Falha ao criar log: " + err.message };
  }

  const opened = spawnTerminalWindow(logFile);
  if (!opened.ok) {
    try { fs.unlinkSync(logFile); } catch { /* ignore */ }
    return { ok: false, reason: opened.reason || "Falha ao abrir janela." };
  }

  currentSession = {
    id,
    logFile,
    pid: opened.pid,
    method: opened.method,
    startedAt: Date.now(),
    lineCount: 0,
  };

  return { ok: true, sessionId: id, logFile, pid: opened.pid, method: opened.method };
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

  const { logFile } = currentSession;

  try {
    fs.appendFileSync(logFile, "__CLOSE_SESSION__\n", "utf-8");
  } catch {
    // ignora
  }

  setTimeout(() => {
    try { fs.unlinkSync(logFile); } catch { /* ignore */ }
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
      if (!entry.name.endsWith(".log")) continue;
      const full = path.join(SESSION_DIR, entry.name);
      try {
        const stat = fs.statSync(full);
        if (now - stat.mtimeMs > maxAgeMs) fs.unlinkSync(full);
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
