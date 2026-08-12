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
  try {
    fs.chmodSync(jarvisDevDir, 0o700);
  } catch {
    // Ignora em sistemas que não suportam (Windows)
  }
}

// 2. Verificar se o arquivo .env existe e carregar
const envPath = getEnvPath();
let envLoaded = false;
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
  try {
    fs.chmodSync(envPath, 0o600);
  } catch {
    // Ignora em sistemas que não suportam
  }
  envLoaded = true;
}

// 3. Ler variáveis (podem ser vazias se o .env não existir)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const JIRA_DOMAIN = process.env.JIRA_DOMAIN || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';
const GEMINI_DAILY_LIMIT = parseInt(process.env.GEMINI_DAILY_LIMIT, 10) || 20;
const GEMINI_WARNING_THRESHOLD = parseInt(process.env.GEMINI_WARNING_THRESHOLD, 10) || 15;

/**
 * Exige que a chave Gemini esteja configurada.
 * Comandos que dependem de IA devem chamar esta função no início.
 * Se a chave não existir, exibe instruções e encerra o processo.
 */
function requireGeminiKey() {
  if (!GEMINI_API_KEY) {
    error('GEMINI_API_KEY não encontrada.');
    if (!envLoaded) {
      dim(`O arquivo ${envPath} não existe.`);
      dim('Execute jarvis config para configurar interativamente.');
    } else {
      dim(`Verifique o arquivo ${envPath}`);
      dim('Execute jarvis config → Credenciais para editar.');
    }
    process.exit(1);
  }
}

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
  requireGeminiKey,
};