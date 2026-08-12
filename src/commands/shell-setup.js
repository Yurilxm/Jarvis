import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  dim,
  blank,
  chalk,
  muted,
} from '../ui.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_SHIM = path.resolve(__dirname, '..', '..', 'bin', 'jarvis.ps1');

function getNpmJarvisPs1() {
  const npmDir = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'npm')
    : path.join(os.homedir(), 'AppData', 'Roaming', 'npm');
  return path.join(npmDir, 'jarvis.ps1');
}

/**
 * Instala o shim PowerShell que aplica Set-Location (cd) na sessao atual.
 */
export function runShellSetup() {
  printBanner();

  if (!fs.existsSync(REPO_SHIM)) {
    warn(`Shim nao encontrado: ${REPO_SHIM}`);
    blank();
    return;
  }

  const target = getNpmJarvisPs1();
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Backup do shim npm original (uma vez)
  if (fs.existsSync(target)) {
    const backup = `${target}.bak`;
    if (!fs.existsSync(backup)) {
      fs.copyFileSync(target, backup);
      dim(`Backup: ${backup}`);
    }
  }

  fs.copyFileSync(REPO_SHIM, target);
  success('Shim PowerShell instalado — o cd passa a funcionar no terminal.');

  printBox(
    `${chalk.bold('Arquivo')}  ${target}\n\n` +
      `${muted('Como usar:')}\n` +
      `  ${chalk.white('jarvis')}        ${muted('selecione o projeto')}\n` +
      `  ${chalk.white('jarvis use')}    ${muted('trocar de projeto + cd')}\n\n` +
      `${muted('Nao use')} ${chalk.yellow('jarvis.cmd')} ${muted('— ele nao consegue dar cd.')}\n` +
      `${muted('Use')} ${chalk.cyan('jarvis')} ${muted('no PowerShell.')}`,
    { title: 'cd no terminal', borderColor: 'green' }
  );

  info('Ja vale nesta sessao: digite jarvis (ou jarvis use) de novo.');
  blank();
}

export function isShellWrapperActive() {
  return process.env.JARVIS_SHELL_WRAPPER === '1';
}
