import path from 'node:path';
import { execSync } from 'node:child_process';
import { isGitRoot } from '../utils/project-scanner.js';
import {
  addManagedProject,
  getManagedProjects,
  setLastProjectPath,
} from '../config/preferences.js';
import {
  printBanner,
  printBox,
  info,
  success,
  error,
  dim,
  blank,
  chalk,
  muted,
} from '../ui.js';

/**
 * Resolve a raiz Git de um caminho (ou null se não for repo).
 * @param {string} dir
 * @returns {string|null}
 */
export function resolveGitProjectRoot(dir) {
  const absolute = path.resolve(dir);

  if (isGitRoot(absolute)) {
    return absolute;
  }

  try {
    const toplevel = execSync('git rev-parse --show-toplevel', {
      cwd: absolute,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return toplevel ? path.resolve(toplevel) : null;
  } catch {
    return null;
  }
}

/**
 * Valida se a pasta é um projeto Git utilizável pelo Jarvis.
 * @param {string} [dir=process.cwd()]
 * @returns {{ ok: true, root: string, name: string } | { ok: false, reason: string }}
 */
export function validateProjectDir(dir = process.cwd()) {
  const absolute = path.resolve(dir);
  const root = resolveGitProjectRoot(absolute);

  if (!root) {
    return {
      ok: false,
      reason: 'Esta pasta não é um repositório Git válido (.git não encontrado).',
    };
  }

  return {
    ok: true,
    root,
    name: path.basename(root),
  };
}

/**
 * Adiciona o projeto atual (ou o path informado) à lista gerenciada.
 * @param {string} [targetPath]
 * @returns {{ added: boolean, already: boolean, root: string, name: string } | null}
 */
export function addCurrentProject(targetPath = process.cwd()) {
  const check = validateProjectDir(targetPath);
  if (!check.ok) {
    return null;
  }

  const already = getManagedProjects().some((p) => p.path === check.root);
  addManagedProject(check.root, check.name);
  setLastProjectPath(check.root);

  return {
    added: !already,
    already,
    root: check.root,
    name: check.name,
  };
}

/**
 * Comando CLI: jarvis add [caminho]
 * @param {string} [targetPath]
 */
export function runAddProject(targetPath) {
  printBanner();

  const target = targetPath ? path.resolve(targetPath) : process.cwd();
  const check = validateProjectDir(target);

  if (!check.ok) {
    error(check.reason);
    dim('Entre na pasta de um repo Git (ou rode jarvis init) e tente de novo.');
    dim(`Caminho atual: ${target}`);
    blank();
    process.exitCode = 1;
    return;
  }

  const result = addCurrentProject(check.root);

  if (result.already) {
    info(`Já estava na lista: ${chalk.bold(result.name)}`);
  } else {
    success(`Projeto adicionado: ${chalk.bold(result.name)}`);
  }

  printBox(
    `${chalk.bold('Nome')}     ${result.name}\n` +
      `${chalk.bold('Caminho')}  ${result.root}\n` +
      muted('Salvo em ~/.jarvis/preferences.json'),
    { title: 'projeto gerenciado', borderColor: 'green' }
  );

  dim('Use jarvis (sem args) ou jarvis use para selecionar este projeto.');
  blank();
}
