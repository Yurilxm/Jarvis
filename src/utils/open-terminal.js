import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Verifica se o Windows Terminal (wt.exe) está disponível.
 * @returns {boolean}
 */
export function hasWindowsTerminal() {
  try {
    execFileSync('where.exe', ['wt'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Abre o caminho num novo terminal Windows.
 * Preferência: Windows Terminal (aba ou janela). Fallback: nova janela PowerShell.
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

  if (hasWindowsTerminal()) {
    // wt -w 0 nt -d PATH  → nova aba na janela atual
    // wt -w -1 nt -d PATH → nova janela
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
    } catch (err) {
      // cai no fallback
    }
  }

  // Fallback: nova janela PowerShell já no diretório
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
  } catch (err) {
    return {
      ok: false,
      method: 'none',
      message: `Não foi possível abrir o terminal: ${err.message}`,
    };
  }
}
