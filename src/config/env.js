import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { error, dim } from '../ui.js';

/**
 * Retorna o caminho do diretório de configuração do Jarvis Dev na home do usuário.
 * ~/.jarvis-dev/
 * @returns {string}
 */
function getJarvisDevDir() {
  return path.join(os.homedir(), '.jarvis-dev');
}

/**
 * Retorna o caminho do arquivo .env na home do usuário.
 * ~/.jarvis-dev/.env
 * @returns {string}
 */
function getEnvPath() {
  return path.join(getJarvisDevDir(), '.env');
}

// 1. Garantir que o diretório ~/.jarvis-dev/ exista
const jarvisDevDir = getJarvisDevDir();
if (!fs.existsSync(jarvisDevDir)) {
  fs.mkdirSync(jarvisDevDir, { recursive: true });
  // Tenta restringir permissão ao dono (Unix/Linux/macOS)
  try {
    fs.chmodSync(jarvisDevDir, 0o700);
  } catch {
    // Ignora em sistemas que não suportam (Windows)
  }
}

// 2. Verificar se o arquivo .env existe
const envPath = getEnvPath();
if (!fs.existsSync(envPath)) {
  error('Arquivo de configuração pessoal não encontrado.');
  dim(`Crie o arquivo ${envPath} com suas chaves de API.`);
  dim('Execute jarvis config para configurar interativamente.');
  dim('');
  dim('Exemplo do conteúdo:');
  dim('  GEMINI_API_KEY=sua-chave-do-gemini');
  dim('  GEMINI_MODEL=gemini-flash-latest');
  dim('  GITHUB_TOKEN=ghp_seu-token');
  dim('  JIRA_DOMAIN=sua-empresa.atlassian.net');
  dim('  JIRA_EMAIL=seu-email@empresa.com');
  dim('  JIRA_API_TOKEN=seu-token-jira');
  process.exit(1);
}

// 3. Carregar o .env da home do usuário
dotenv.config({ path: envPath, quiet: true });

// 4. Tentar restringir permissão do arquivo ao dono
try {
  fs.chmodSync(envPath, 0o600);
} catch {
  // Ignora em sistemas que não suportam
}

// 5. Validar chave obrigatória
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

if (!GEMINI_API_KEY) {
  error('GEMINI_API_KEY não encontrada no arquivo .env');
  dim(`Verifique o arquivo ${envPath}`);
  dim('Adicione: GEMINI_API_KEY=sua-chave-aqui');
  process.exit(1);
}

// GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Jira
const JIRA_DOMAIN = process.env.JIRA_DOMAIN || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';

// Gemini — limites de cota
const GEMINI_DAILY_LIMIT = parseInt(process.env.GEMINI_DAILY_LIMIT, 10) || 20;
const GEMINI_WARNING_THRESHOLD = parseInt(process.env.GEMINI_WARNING_THRESHOLD, 10) || 15;

export {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GITHUB_TOKEN,
  JIRA_DOMAIN,
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  GEMINI_DAILY_LIMIT,
  GEMINI_WARNING_THRESHOLD,
  getEnvPath,
};