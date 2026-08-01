import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/**
 * Executa git e captura stdout mesmo quando exit code = 1 (diff com alterações).
 * @param {string[]} args
 * @returns {string}
 */
function gitOutput(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (typeof error.stdout === 'string' && error.stdout.length > 0) {
      return error.stdout;
    }
    return '';
  }
}

/**
 * Obtém o diff das alterações staged (prontas para commit).
 * @returns {string}
 */
export function getStagedDiff() {
  return gitOutput(['diff', '--staged']);
}

/**
 * Obtém o diff das alterações não staged (modificadas mas não adicionadas).
 * @returns {string}
 */
export function getUnstagedDiff() {
  return gitOutput(['diff']);
}

/**
 * Obtém o diff completo (staged + unstaged).
 * @returns {string}
 */
export function getFullDiff() {
  const staged = getStagedDiff().trim();
  const unstaged = getUnstagedDiff().trim();

  if (staged && unstaged) {
    return `=== ALTERAÇÕES STAGED ===\n${staged}\n\n=== ALTERAÇÕES NÃO STAGED ===\n${unstaged}`;
  }

  return staged || unstaged || '';
}

/**
 * Diff apenas dos arquivos informados (tracked staged/unstaged).
 * @param {string[]} files
 * @returns {string}
 */
export function getTrackedDiffForFiles(files) {
  if (!files || files.length === 0) return '';

  const staged = gitOutput(['diff', '--staged', '--', ...files]).trim();
  const unstaged = gitOutput(['diff', '--', ...files]).trim();

  if (staged && unstaged) {
    return `=== ALTERAÇÕES STAGED ===\n${staged}\n\n=== ALTERAÇÕES NÃO STAGED ===\n${unstaged}`;
  }

  return staged || unstaged || '';
}

/**
 * Monta um diff sintético para arquivos não rastreados (texto).
 * @param {string[]} files
 * @returns {string}
 */
export function getUntrackedDiffForFiles(files) {
  if (!files || files.length === 0) return '';

  const parts = [];

  for (const file of files) {
    try {
      const buf = fs.readFileSync(file);
      if (buf.includes(0)) {
        parts.push(`=== UNTRACKED (binário ignorado no prompt) ===\n${file}\n`);
        continue;
      }

      const content = buf.toString('utf-8');
      const lines = content.split('\n');
      const body = lines.map((line) => `+${line}`).join('\n');

      parts.push(
        `diff --git a/${file} b/${file}\n` +
        `new file mode 100644\n` +
        `--- /dev/null\n` +
        `+++ b/${file}\n` +
        `@@ -0,0 +1,${lines.length} @@\n` +
        `${body}`
      );
    } catch {
      // arquivo removido entre status e leitura
    }
  }

  return parts.join('\n\n');
}

/**
 * Diff completo só dos arquivos safe: tracked + untracked.
 * @param {{ tracked: string[], untracked: string[] }} files
 * @returns {string}
 */
export function getSafeDiff({ tracked, untracked }) {
  const trackedDiff = getTrackedDiffForFiles(tracked).trim();
  const untrackedDiff = getUntrackedDiffForFiles(untracked).trim();

  if (trackedDiff && untrackedDiff) {
    return `${trackedDiff}\n\n=== ARQUIVOS NOVOS ===\n${untrackedDiff}`;
  }

  return trackedDiff || untrackedDiff || '';
}

/**
 * Adiciona ao staging apenas os arquivos informados.
 * @param {string[]} files
 */
export function stageFiles(files) {
  if (!files || files.length === 0) {
    throw new Error('Nenhum arquivo para adicionar ao staging.');
  }

  const chunkSize = 50;
  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);
    execFileSync('git', ['add', '--', ...chunk], { stdio: 'inherit' });
  }
}
