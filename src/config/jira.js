import { JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN } from './env.js';
import { error, dim } from '../ui.js';

export function getJiraConfig() {
  if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    error('Configuração do Jira incompleta.');
    dim('Adicione no .env: JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN');
    process.exit(1);
  }

  return {
    domain: JIRA_DOMAIN,
    email: JIRA_EMAIL,
    token: JIRA_API_TOKEN,
  };
}

export function getJiraAuthHeader() {
  const { email, token } = getJiraConfig();
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

export function getJiraBaseUrl() {
  const { domain } = getJiraConfig();
  return `https://${domain}`;
}