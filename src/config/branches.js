import { getProjectConfig } from './project.js';

/**
 * Branches do projeto atual (.jarvis-dev.json no cwd).
 * Sempre leem de novo — seguro após process.chdir no seletor de projetos.
 */

export function getProtectedBranch() {
  return getProjectConfig('git.protectedBranch', 'main');
}

export function getDevelopmentBranch() {
  return getProjectConfig('git.developmentBranch', 'dev');
}
