import { octokit } from './client.js';

/**
 * Busca os dados do usuário autenticado na GitHub API.
 * @returns {Promise<{name: string, githubUsername: string}>}
 */
export async function fetchGitHubUser() {
  const { data } = await octokit.rest.users.getAuthenticated();

  return {
    name: data.name || data.login,
    githubUsername: data.login,
  };
}