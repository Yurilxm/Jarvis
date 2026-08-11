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
 * Remove aspas externas de um path e desfaz o escaping C-style
 * que o Git usa para paths com espaços, acentos ou caracteres especiais.
 * @param {string} str
 * @returns {string}
 */
export function unquotePath(str) {
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    str = str.slice(1, -1);
    str = str.replace(/\\([0-7]{3}|["\\abfnrtv])/g, (match, esc) => {
      if (/^[0-7]{3}$/.test(esc)) {
        return String.fromCharCode(parseInt(esc, 8));
      }
      const map = { '"': '"', '\\': '\\', a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
      return map[esc] ?? esc;
    });
  }
  return str;
}

/**
 * Faz o parsing de uma linha do `git status --porcelain`.
 * @param {string} rawLine
 * @returns {{ status: string, file: string }}
 */
export function parsePorcelainLine(rawLine) {
  let line = rawLine;

  // Caso 1: a linha inteira veio entre aspas
  if (line.startsWith('"') && line.endsWith('"')) {
    line = unquotePath(line);
  }

  const status = line.substring(0, 2);
  let file = line.substring(3).trim();

  // Caso 2: só o path veio entre aspas
  file = unquotePath(file);

  // Renomeios: pega apenas o novo path
  if (file.includes(' -> ')) {
    const parts = file.split(' -> ');
    file = unquotePath(parts[parts.length - 1].trim());
  }

  return { status, file };
}

/**
 * Obtém o status do repositório Git.
 * Retorna listas de arquivos modificados, adicionados, removidos e não rastreados.
 *
 * @returns {{ staged: string[], modified: string[], deleted: string[], untracked: string[] }}
 */
export function getGitStatus() {
  const output = execSync('git status --porcelain', { encoding: 'utf-8' }).replace(/\r?\n+$/, '');

  const staged = [];
  const modified = [];
  const deleted = [];
  const untracked = [];

  if (!output) {
    return { staged, modified, deleted, untracked };
  }

  for (const rawLine of output.split('\n')) {
    if (!rawLine) continue;

    const { status, file } = parsePorcelainLine(rawLine);
    const index = status[0];
    const workTree = status[1];

    if (status === '??') {
      untracked.push(file);
      continue;
    }

    if (index === 'M' || index === 'A' || index === 'R') {
      staged.push(file);
    }

    if (workTree === 'M') {
      modified.push(file);
    }

    if (workTree === 'D' || index === 'D') {
      deleted.push(file);
    }
  }

  return { staged, modified, deleted, untracked };
}