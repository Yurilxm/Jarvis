import { GITHUB_TOKEN } from './env.js';
import chalk from 'chalk';
import logSymbols from 'log-symbols';

/**
 * Valida e retorna o token do GitHub.
 * Se não estiver configurado, exibe um aviso e retorna string vazia.
 * @returns {string}
 */
export function getGitHubToken() {
  if (!GITHUB_TOKEN) {
    console.error(chalk.red(`${logSymbols.error} GITHUB_TOKEN não encontrada no arquivo .env`));
    console.error(chalk.dim('Adicione: GITHUB_TOKEN=ghp_seu_token_aqui'));
    console.error(chalk.dim('Obtenha em: https://github.com/settings/tokens'));
    console.error(chalk.dim('Permissões necessárias: repo, pull_requests'));
    console.error(chalk.dim('Execute jarvis config → Credenciais para configurar.'));
    return '';
  }
  return GITHUB_TOKEN;
}