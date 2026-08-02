import fs from 'node:fs';
import path from 'node:path';
import { info, dim } from '../ui.js';

/**
 * Carrega a configuração do projeto (.jarvis-dev.json) da raiz do diretório atual.
 * @returns {object}
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
 * Retorna um valor da config do projeto, com fallback.
 * @param {string} path - ex: 'jira.projectKey'
 * @param {*} defaultValue
 * @returns {*}
 */
export function getProjectConfig(path, defaultValue = null) {
  const config = loadProjectConfig();
  if (!config) return defaultValue;

  const keys = path.split('.');
  let value = config;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  return value ?? defaultValue;
}