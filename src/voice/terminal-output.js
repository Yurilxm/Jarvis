import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const VOICE_TMP_DIR = path.join(os.tmpdir(), "jarvis-voz");

/**
 * Garante que a pasta de scripts temporarios existe.
 */
function ensureTmpDir() {
  if (!fs.existsSync(VOICE_TMP_DIR)) {
    fs.mkdirSync(VOICE_TMP_DIR, { recursive: true });
  }
}

/**
 * Escapa uma string para uso seguro em single-quoted PowerShell string.
 * Dentro de single quotes, basta duplicar ' -> ''.
 *
 * @param {string} s
 * @returns {string}
 */
export function escapePowerShellSingleQuoted(s) {
  return String(s).replace(/'/g, "''");
}

/**
 * Monta o conteudo de um script .ps1 que roda `jarvis <argv>` no cwd.
 * Funcao pura — testavel.
 *
 * @param {string[]} argv - argumentos (ex: ["jira", "list"])
 * @param {string} cwd - diretorio de trabalho
 * @returns {string}
 */
export function buildJarvisScriptContent(argv, cwd) {
  const safeCwd = escapePowerShellSingleQuoted(cwd);
  const argsLine = (argv || [])
    .map((a) => "'" + escapePowerShellSingleQuoted(a) + "'")
    .join(" ");

  return [
    "# Script temporario gerado pelo Jarvis Voz",
    "# Pode apagar este arquivo com seguranca.",
    "Set-Location -LiteralPath '" + safeCwd + "'",
    "jarvis " + argsLine,
    "",
  ].join("\r\n");
}

/**
 * Gera um script .ps1 temporario que executa `jarvis <argv>`.
 *
 * @param {string[]} argv
 * @param {string} cwd
 * @returns {string} caminho absoluto do script
 */
export function generateJarvisScript(argv, cwd) {
  ensureTmpDir();
  const scriptPath = path.join(VOICE_TMP_DIR, "cmd-" + Date.now() + ".ps1");
  const content = buildJarvisScriptContent(argv, cwd);
  fs.writeFileSync(scriptPath, content, "utf-8");
  return scriptPath;
}

/**
 * Remove scripts temporarios mais antigos que `maxAgeMs`.
 * Roda silenciosamente.
 *
 * @param {number} [maxAgeMs=86400000] - 1 dia por padrao
 */
export function cleanupOldScripts(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    if (!fs.existsSync(VOICE_TMP_DIR)) return;
    const now = Date.now();
    const entries = fs.readdirSync(VOICE_TMP_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith("cmd-") || !entry.name.endsWith(".ps1")) continue;
      const full = path.join(VOICE_TMP_DIR, entry.name);
      try {
        const stat = fs.statSync(full);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(full);
        }
      } catch {
        // ignora
      }
    }
  } catch {
    // ignora
  }
}

function tryWindowsTerminal(scriptPath, mode) {
  const wtArgs =
    mode === "new-window"
      ? ["-w", "-1", "nt", "powershell.exe", "-NoExit", "-File", scriptPath]
      : ["-w", "0", "nt", "powershell.exe", "-NoExit", "-File", scriptPath];

  try {
    const child = spawn("wt.exe", wtArgs, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return {
      ok: true,
      method: mode === "new-window" ? "wt-window" : "wt-tab",
      message:
        mode === "new-window"
          ? "Nova janela do Windows Terminal aberta com o comando."
          : "Nova aba do Windows Terminal aberta com o comando.",
    };
  } catch {
    return null;
  }
}

function tryPowerShell(scriptPath) {
  try {
    const child = spawn(
      "powershell.exe",
      ["-NoExit", "-NoLogo", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { detached: true, stdio: "ignore", windowsHide: false }
    );
    child.unref();
    return {
      ok: true,
      method: "powershell",
      message: "Nova janela do PowerShell aberta com o comando.",
    };
  } catch {
    return null;
  }
}

/**
 * Abre um terminal (aba ou janela) executando o script .ps1 informado.
 *
 * @param {string} scriptPath
 * @param {"new-tab" | "new-window"} [mode="new-tab"]
 * @returns {{ ok: boolean, method: string, message: string }}
 */
export function openTerminalRunningScript(scriptPath, mode = "new-tab") {
  if (!fs.existsSync(scriptPath)) {
    return { ok: false, method: "none", message: "Script nao encontrado: " + scriptPath };
  }

  if (process.platform !== "win32") {
    return {
      ok: false,
      method: "unsupported",
      message: "Abertura automatica de terminal so esta disponivel no Windows.",
    };
  }

  const wtResult = tryWindowsTerminal(scriptPath, mode);
  if (wtResult) return wtResult;

  const psResult = tryPowerShell(scriptPath);
  if (psResult) return psResult;

  return { ok: false, method: "none", message: "Nao foi possivel abrir nenhum terminal." };
}
