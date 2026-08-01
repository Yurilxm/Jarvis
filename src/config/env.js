import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { error, dim } from '../ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

if (!GEMINI_API_KEY) {
  error('GEMINI_API_KEY não encontrada no arquivo .env');
  dim('Adicione: GEMINI_API_KEY=sua-chave-aqui');
  process.exit(1);
}

// GitHub
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Jira
const JIRA_DOMAIN = process.env.JIRA_DOMAIN || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';

export { GEMINI_API_KEY, GEMINI_MODEL, GITHUB_TOKEN, JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN };