import { execSync } from 'node:child_process';

/**
 * Obtém o diff das alterações staged (prontas para commit).
 * @returns {string}
 */
export function getStagedDiff() {
  try {
    return execSync('git diff --staged', { encoding: 'utf-8' });
  } catch {
    return '';
  }
}

/**
 * Obtém o diff das alterações não staged (modificadas mas não adicionadas).
 * @returns {string}
 */
export function getUnstagedDiff() {
  try {
    return execSync('git diff', { encoding: 'utf-8' });
  } catch {
    return '';
  }
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