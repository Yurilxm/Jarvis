/**
 * Pós-instalação: no Windows, libera `jarvis` (ExecutionPolicy) e instala o shim .ps1.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';

if (!isWindows) {
  process.exit(0);
}

const ps1 = path.join(__dirname, 'install-windows.ps1');
if (!fs.existsSync(ps1)) {
  console.warn('[jarvis] scripts/install-windows.ps1 não encontrado — pulando setup Windows.');
  process.exit(0);
}

const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1],
  { stdio: 'inherit', windowsHide: true }
);

if (result.error) {
  console.warn(`[jarvis] Setup Windows falhou: ${result.error.message}`);
  console.warn('[jarvis] Rode manualmente: npm run setup');
  process.exit(0);
}

if (typeof result.status === 'number' && result.status !== 0) {
  console.warn(`[jarvis] Setup Windows saiu com código ${result.status}. Rode: npm run setup`);
}
