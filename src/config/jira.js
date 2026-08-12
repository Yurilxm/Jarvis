import { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } from './env.js';
import { error, dim } from '../ui.js';

export function getJiraConfig() {
  if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    error('Configuração do Jira incompleta.');
    dim('Adicione no .env: JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN');
    dim('Execute jarvis config → Credenciais para configurar.');
    // Retorna um objeto vazio para evitar quebrar o fluxo
    return { domain: '', email: '', token: '' };
  }

  return {
    domain: JIRA_DOMAIN,
    email: JIRA_EMAIL,
    token: JIRA_API_TOKEN,
  };
}

export function getJiraAuthHeader() {
  const { email, token } = getJiraConfig();
  if (!email || !token) return '';
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

export function getJiraBaseUrl() {
  const { domain } = getJiraConfig();
  if (!domain) return '';
  return `https://${domain}`;
}