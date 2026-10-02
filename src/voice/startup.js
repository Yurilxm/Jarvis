import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const STARTUP_FILENAME = 'JarvisVoz.vbs';
const LEGACY_BAT_FILENAME = 'JarvisVoz.bat';

/**
 * Caminho da pasta Startup do usuário atual.
 * @returns {string|null}
 */
export function getStartupDir() {
  if (process.platform !== 'win32') return null;
  const appData = process.env.APPDATA;
  if (!appData) return null;
  return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

/**
 * Caminho do script .vbs de startup.
 * @returns {string|null}
 */
export function getStartupPath() {
  const dir = getStartupDir();
  return dir ? path.join(dir, STARTUP_FILENAME) : null;
}

/**
 * Caminho do .bat legado (era a versão antiga).
 * @returns {string|null}
 */
export function getLegacyBatPath() {
  const dir = getStartupDir();
  return dir ? path.join(dir, LEGACY_BAT_FILENAME) : null;
}

/**
 * Caminho do jarvis.cmd no diretório global do npm.
 * @returns {string}
 */
function getJarvisCmdPath() {
  const npmDir = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'npm')
    : path.join(os.homedir(), 'AppData', 'Roaming', 'npm');
  return path.join(npmDir, 'jarvis.cmd');
}

/**
 * Monta o conteúdo do script VBScript que inicia o Jarvis Voz em modo
 * wake word, totalmente oculto, com log em arquivo.
 *
 * Por que VBS: no Windows, .vbs é a forma mais confiável de rodar algo
 * invisível no startup sem abrir janela nenhuma. O .bat com "start /min"
 * ainda pisca uma janela por um instante.
 *
 * @returns {string}
 */
export function buildStartupScript() {
  const jarvisCmd = getJarvisCmdPath();

  return [
    "' Jarvis Dev — Startup Wake Word",
    "' Gerado por: jarvis voz --instalar-startup",
    "' Log em: %USERPROFILE%\\.jarvis-dev\\voz.log",
    'Option Explicit',
    'Dim WshShell, FSO, userProfile, jarvisCmd, logPath',
    'Set WshShell = CreateObject("WScript.Shell")',
    'Set FSO = CreateObject("Scripting.FileSystemObject")',
    'userProfile = WshShell.ExpandEnvironmentStrings("%USERPROFILE%")',
    `jarvisCmd = "${jarvisCmd.replace(/\\/g, '\\\\')}"`,
    'logPath = userProfile & "\\.jarvis-dev\\voz.log"',
    '',
    "' Garante que a pasta .jarvis-dev existe",
    'If Not FSO.FolderExists(userProfile & "\\.jarvis-dev") Then',
    '  FSO.CreateFolder(userProfile & "\\.jarvis-dev")',
    'End If',
    '',
    "' Só roda se o jarvis.cmd existe (npm link foi feito)",
    'If FSO.FileExists(jarvisCmd) Then',
    '  WshShell.CurrentDirectory = userProfile',
    '  WshShell.Run """" & jarvisCmd & """ voz --wake > """ & logPath & """ 2>&1", 0, False',
    'End If',
    '',
  ].join('\r\n');
}

/**
 * Instala o atalho de startup. Remove o .bat antigo se existir.
 * @returns {{ ok: boolean, path?: string, reason?: string, removedLegacy?: boolean }}
 */
export function installStartup() {
  const dir = getStartupDir();
  if (!dir) {
    return {
      ok: false,
      reason:
        'Instalação automática de startup só está disponível no Windows.\n' +
        '  No macOS/Linux, configure manualmente o início do comando "jarvis voz --wake".',
    };
  }

  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      return { ok: false, reason: `Não foi possível criar a pasta Startup: ${err.message}` };
    }
  }

  // Remove o .bat legado (versão antiga)
  let removedLegacy = false;
  const legacy = getLegacyBatPath();
  if (legacy && fs.existsSync(legacy)) {
    try {
      fs.unlinkSync(legacy);
      removedLegacy = true;
    } catch {
      // silencioso
    }
  }

  const target = path.join(dir, STARTUP_FILENAME);
  try {
    fs.writeFileSync(target, buildStartupScript(), 'utf-8');
    return { ok: true, path: target, removedLegacy };
  } catch (err) {
    return { ok: false, reason: `Erro ao gravar atalho: ${err.message}` };
  }
}

/**
 * Remove o atalho de startup (VBS + BAT legado).
 * @returns {{ ok: boolean, path?: string, removed?: boolean, reason?: string }}
 */
export function removeStartup() {
  const target = getStartupPath();
  if (!target) {
    return { ok: false, reason: 'Startup só está disponível no Windows.' };
  }

  let removed = false;

  if (fs.existsSync(target)) {
    try {
      fs.unlinkSync(target);
      removed = true;
    } catch (err) {
      return { ok: false, reason: `Erro ao remover: ${err.message}` };
    }
  }

  const legacy = getLegacyBatPath();
  if (legacy && fs.existsSync(legacy)) {
    try {
      fs.unlinkSync(legacy);
      removed = true;
    } catch {
      // silencioso
    }
  }

  return { ok: true, removed, path: target };
}

/**
 * Verifica se o atalho está instalado.
 * @returns {boolean}
 */
export function isStartupInstalled() {
  const target = getStartupPath();
  return Boolean(target && fs.existsSync(target));
}
