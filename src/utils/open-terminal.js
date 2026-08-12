import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function isWindows() {
  return process.platform === 'win32';
}

/**
 * Verifica se o Windows Terminal (wt.exe) está disponível.
 * @returns {boolean}
 */
export function hasWindowsTerminal() {
  if (!isWindows()) return false;
  try {
    execFileSync('where.exe', ['wt'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function openWithWindowsTerminal(absolute, mode) {
  if (!hasWindowsTerminal()) return null;
  const args =
    mode === 'new-window'
      ? ['-w', '-1', 'nt', '-d', absolute]
      : ['-w', '0', 'nt', '-d', absolute];

  try {
    const child = spawn('wt.exe', args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return {
      ok: true,
      method: mode === 'new-window' ? 'windows-terminal-window' : 'windows-terminal-tab',
      message:
        mode === 'new-window'
          ? 'Nova janela do Windows Terminal aberta no projeto.'
          : 'Nova aba do Windows Terminal aberta no projeto.',
    };
  } catch {
    return null;
  }
}

function openWithPowerShell(absolute) {
  if (!isWindows()) return null;
  try {
    const child = spawn(
      'powershell.exe',
      ['-NoExit', '-NoLogo', '-Command', `Set-Location -LiteralPath '${absolute.replace(/'/g, "''")}'`],
      { detached: true, stdio: 'ignore', windowsHide: false }
    );
    child.unref();
    return {
      ok: true,
      method: 'powershell-window',
      message: 'Nova janela do PowerShell aberta no projeto.',
    };
  } catch {
    return null;
  }
}

/**
 * Abre o caminho num novo terminal.
 * Suporta Windows Terminal / PowerShell no Windows.
 * Linux/macOS: retorna aviso (ainda não suportado).
 *
 * @param {string} projectPath
 * @param {'new-tab' | 'new-window'} mode
 * @returns {{ ok: boolean, method: string, message: string }}
 */
export function openProjectInTerminal(projectPath, mode = 'new-tab') {
  const absolute = path.resolve(projectPath);
  if (!fs.existsSync(absolute)) {
    return { ok: false, method: 'none', message: `Pasta não encontrada: ${absolute}` };
  }

  // Windows Terminal
  const wtResult = openWithWindowsTerminal(absolute, mode);
  if (wtResult) return wtResult;

  // PowerShell (Windows)
  const psResult = openWithPowerShell(absolute);
  if (psResult) return psResult;

  // Linux/macOS
  if (process.platform === 'linux' || process.platform === 'darwin') {
    return {
      ok: false,
      method: 'unsupported',
      message: 'Abertura automática de terminal ainda não é suportada neste sistema. Use projectOpenMode "none" ou "shell-cd".',
    };
  }

  return { ok: false, method: 'none', message: 'Não foi possível abrir o terminal.' };
}