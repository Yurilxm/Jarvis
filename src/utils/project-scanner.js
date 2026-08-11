import fs from 'node:fs';
import path from 'node:path';

/** Pastas que nunca entram na varredura. */
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.jarvis',
  'dist',
  'build',
  'coverage',
  'venv',
  '.venv',
  '__pycache__',
  '.next',
  '.turbo',
  '.cache',
  'vendor',
  'target',
  '.idea',
  '.vscode',
]);

/**
 * Verifica se o diretório é a raiz de um repositório Git (.git dir ou file).
 * @param {string} dir
 * @returns {boolean}
 */
export function isGitRoot(dir) {
  try {
    const gitPath = path.join(dir, '.git');
    if (!fs.existsSync(gitPath)) return false;
    const stat = fs.lstatSync(gitPath);
    return stat.isDirectory() || stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Varre subpastas em busca de repositórios Git.
 * A raiz (`rootDir`) continua sendo o contexto vinculado do Jarvis;
 * os projetos encontrados são só descoberta (não mudam o cwd).
 *
 * @param {string} [rootDir=process.cwd()]
 * @param {{ maxDepth?: number }} [options]
 * @returns {{
 *   root: string,
 *   rootIsGit: boolean,
 *   maxDepth: number,
 *   projects: Array<{ name: string, relativePath: string, absolutePath: string, depth: number }>
 * }}
 */
export function discoverProjects(rootDir = process.cwd(), { maxDepth = 4 } = {}) {
  const root = path.resolve(rootDir);
  const depthLimit = Math.max(1, Math.min(Number(maxDepth) || 4, 10));
  const projects = [];

  function walk(current, depth) {
    if (depth > depthLimit) return;

    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.git') continue;

      const absolutePath = path.join(current, entry.name);

      let isDir = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        try {
          isDir = fs.statSync(absolutePath).isDirectory();
        } catch {
          continue;
        }
      }
      if (!isDir) continue;

      if (isGitRoot(absolutePath)) {
        const relativePath = path.relative(root, absolutePath) || '.';
        projects.push({
          name: entry.name,
          relativePath: relativePath.split(path.sep).join('/'),
          absolutePath,
          depth,
        });
      }

      // Continua descendo (ex.: monorepo com repos aninhados), respeitando maxDepth.
      walk(absolutePath, depth + 1);
    }
  }

  walk(root, 1);

  projects.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return {
    root,
    rootIsGit: isGitRoot(root),
    maxDepth: depthLimit,
    projects,
  };
}
