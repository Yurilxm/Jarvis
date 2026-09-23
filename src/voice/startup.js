import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const STARTUP_FILENAME = 'JarvisVoz.bat';

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
 * Caminho do arquivo .bat de startup.
 * @returns {string|null}
 */
export function getStartupPath() {
  const dir = getStartupDir();
  return dir ? path.join(dir, STARTUP_FILENAME) : null;
}

/**
 * Monta o conteúdo do .bat que inicia o Jarvis Voz em modo wake word,
 * minimizado, sem janela visível.
 *
 * @returns {string}
 */
export function buildStartupScript() {
  return [
    '@echo off',
    'title Jarvis Voz',
    'REM Inicia o Jarvis Voz em modo wake word',
    'REM Gerado por: jarvis voz --instalar-startup',
    'cd /d "%USERPROFILE%"',
    'start "" /min cmd /c "jarvis voz --wake"',
    'exit',
    '',
  ].join('\r\n');
}

/**
 * Instala o atalho de startup.
 * @returns {{ ok: boolean, path?: string, reason?: string }}
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

  const target = path.join(dir, STARTUP_FILENAME);
  try {
    fs.writeFileSync(target, buildStartupScript(), 'utf-8');
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, reason: `Erro ao gravar atalho: ${err.message}` };
  }
}

/**
 * Remove o atalho de startup.
 * @returns {{ ok: boolean, path?: string, removed?: boolean, reason?: string }}
 */
export function removeStartup() {
  const target = getStartupPath();
  if (!target) {
    return { ok: false, reason: 'Startup só está disponível no Windows.' };
  }

  if (!fs.existsSync(target)) {
    return { ok: true, removed: false, path: target };
  }

  try {
    fs.unlinkSync(target);
    return { ok: true, removed: true, path: target };
  } catch (err) {
    return { ok: false, reason: `Erro ao remover: ${err.message}` };
  }
}

/**
 * Verifica se o atalho está instalado.
 * @returns {boolean}
 */
export function isStartupInstalled() {
  const target = getStartupPath();
  return Boolean(target && fs.existsSync(target));
}