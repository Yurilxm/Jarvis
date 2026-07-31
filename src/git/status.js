import { execSync } from 'node:child_process';

/**
 * Verifica se o diretório atual está dentro de um repositório Git.
 * @returns {boolean}
 */
export function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Inicializa um repositório Git na pasta atual.
 * @param {string} defaultBranch
 * @returns {{ success: boolean, message: string }}
 */
export function initRepo(defaultBranch = 'main') {
  try {
    execSync(`git init -b ${defaultBranch}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return {
      success: true,
      message: `Repositório Git inicializado na branch '${defaultBranch}'.`,
    };
  } catch (error) {
    return {
      success: false,
      message: error.stderr?.trim() || error.message,
    };
  }
}

/**
 * Obtém o status do repositório Git.
 * Retorna listas de arquivos modificados, adicionados, removidos e não rastreados.
 *
 * @returns {{ staged: string[], modified: string[], deleted: string[], untracked: string[] }}
 */
export function getGitStatus() {
  // --porcelain dá uma saída fácil de parsear
  const output = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();

  const staged = [];
  const modified = [];
  const deleted = [];
  const untracked = [];

  if (!output) {
    return { staged, modified, deleted, untracked };
  }

  for (const line of output.split('\n')) {
    const status = line.substring(0, 2);
    const file = line.substring(3).trim();

    // Status no índice (primeiro caractere) e na árvore de trabalho (segundo caractere)
    const index = status[0];
    const workTree = status[1];

    // Arquivos staged (adicionados ao índice)
    if (index === 'M' || index === 'A' || index === 'R') {
      staged.push(file);
    }

    // Arquivos modificados na árvore de trabalho
    if (workTree === 'M') {
      modified.push(file);
    }

    // Arquivos removidos
    if (workTree === 'D' || index === 'D') {
      deleted.push(file);
    }

    // Arquivos não rastreados
    if (status === '??') {
      untracked.push(file);
    }
  }

  return { staged, modified, deleted, untracked };
}