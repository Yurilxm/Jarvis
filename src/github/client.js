import { Octokit } from 'octokit';
import { getGitHubToken } from '../config/github.js';

let octokitInstance = null;

/**
 * Retorna uma instância do Octokit com o token atual.
 * O token é lido sob demanda para refletir alterações sem reiniciar.
 * @returns {Octokit}
 */
export function getOctokit() {
  if (octokitInstance) return octokitInstance;

  const token = getGitHubToken();
  octokitInstance = new Octokit({ auth: token || undefined });
  return octokitInstance;
}

/**
 * Proxy compatível com os imports antigos.
 * Ex.: `import { octokit } from './client.js';`
 * O acesso a qualquer propriedade (ex: `octokit.rest`) resolve sob demanda.
 */
export const octokit = new Proxy({}, {
  get(_target, prop) {
    const instance = getOctokit();
    return instance[prop];
  },
});

export { getGitHubToken };