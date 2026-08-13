import fs from 'node:fs';
import path from 'node:path';
import { info, dim } from '../ui.js';
import { loadPreferences } from './preferences.js';

/**
 * Carrega a configuração do projeto (.jarvis-dev.json) da raiz do diretório atual.
 * @returns {object|null}
 */
export function loadProjectConfig() {
  const cwd = process.cwd();
  const configPath = path.join(cwd, '.jarvis-dev.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    info('Arquivo .jarvis-dev.json encontrado mas inválido.');
    dim(err.message);
    return null;
  }
}

/**
 * Retorna um valor de configuração do projeto, com fallback global.
 * Prioridade: projeto (.jarvis-dev.json) → global (~/.jarvis/preferences.json) → padrão.
 *
 * @param {string} path - ex: 'jira.projectKey'
 * @param {*} defaultValue
 * @returns {*}
 */
export function getProjectConfig(path, defaultValue = null) {
  const project = loadProjectConfig();
  const prefs = loadPreferences();

  switch (path) {
    case 'jira.projectKey':
      return project?.jira?.projectKey || prefs.jiraProjectKey || defaultValue;
    case 'jira.projectId':
      return project?.jira?.projectId || prefs.jiraProjectId || defaultValue;
    case 'jira.issueType':
      return project?.jira?.issueType || prefs.jiraIssueType || defaultValue;
    case 'git.protectedBranch':
      return project?.git?.protectedBranch || 'main';
    case 'git.developmentBranch':
      return project?.git?.developmentBranch || 'dev';
    default:
      return defaultValue;
  }
}