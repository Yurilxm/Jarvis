import { getProjectConfig } from './project.js';

/**
 * Configuração centralizada de branches.
 * Lê do .jarvis-dev.json do projeto atual, com fallback.
 */
export const PROTECTED_BRANCH = getProjectConfig('git.protectedBranch', 'main');
export const DEVELOPMENT_BRANCH = getProjectConfig('git.developmentBranch', 'dev');