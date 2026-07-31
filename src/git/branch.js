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
 * @param {string} branch
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

/**
 * Verifica se existem alterações não commitadas (incluindo untracked).
 * @returns {boolean}
 */
export function hasUncommittedChanges() {
  const output = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  return output.length > 0;
}

/**
 * Troca para uma branch.
 * @param {string} branchName
 * @returns {{ success: boolean, message: string }}
 */
export function switchBranch(branchName) {
  try {
    execSync(`git checkout ${branchName}`, { encoding: 'utf-8', stdio: 'pipe' });
    return { success: true, message: `Troca para '${branchName}' realizada.` };
  } catch (error) {
    return { success: false, message: error.stderr?.trim() || error.message };
  }
}

/**
 * Cria uma nova branch a partir da branch atual.
 * @param {string} branchName
 * @returns {{ success: boolean, message: string }}
 */
export function createBranch(branchName) {
  try {
    execSync(`git branch ${branchName}`, { encoding: 'utf-8', stdio: 'pipe' });
    return { success: true, message: `Branch '${branchName}' criada.` };
  } catch (error) {
    return { success: false, message: error.stderr?.trim() || error.message };
  }
}

/**
 * Faz merge de uma branch na branch atual.
 * @param {string} sourceBranch - Branch de origem
 * @returns {{ success: boolean, message: string, conflicted: boolean }}
 */
export function mergeBranch(sourceBranch) {
  try {
    const output = execSync(`git merge ${sourceBranch}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { success: true, message: output.trim(), conflicted: false };
  } catch (error) {
    const stderr = error.stderr?.trim() || error.message;
    const conflicted = stderr.includes('CONFLICT') || stderr.includes('Automatic merge failed');
    return { success: false, message: stderr, conflicted };
  }
}

/**
 * Verifica se a branch local tem commits não enviados para o remote.
 * @param {string} branch
 * @returns {boolean}
 */
export function hasUnpushedCommits(branch) {
  try {
    const output = execSync(`git log origin/${branch}..${branch} --oneline`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
    return output.length > 0;
  } catch {
    // Se o remote não existir, considera que tem commits não enviados
    return true;
  }
}