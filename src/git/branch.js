import { execSync } from 'node:child_process';

/**
 * Retorna o nome da branch atual.
 * @returns {string}
 */
export function getCurrentBranch() {
  return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
}

/**
 * Lista todas as branches locais.
 * @returns {string[]}
 */
export function listBranches() {
  const output = execSync('git branch', { encoding: 'utf-8' }).trim();
  return output
    .split('\n')
    .map(line => line.replace(/^\*?\s+/, ''));
}

/**
 * Verifica se a branch atual tem um remote configurado para push.
 * @returns {string|null} Nome do remote ou null
 */
export function getPushRemote(branch) {
  try {
    return execSync(`git config --get branch.${branch}.remote`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
  } catch {
    return null;
  }
}