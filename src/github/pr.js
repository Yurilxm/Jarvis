import { octokit } from './client.js';
import { execSync } from 'node:child_process';

/**
 * Extrai owner e repo do remote origin.
 * @returns {{ owner: string, repo: string }}
 */
export function getRepoInfo() {
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    // Suporta HTTPS: https://github.com/owner/repo.git
    // E SSH: git@github.com:owner/repo.git
    const match = remote.match(/github\.com[/:](.+?)\/(.+?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    // sem remote
  }
  return { owner: null, repo: null };
}

/**
 * Lista PRs abertas.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array>}
 */
export async function listPullRequests(owner, repo) {
  const { data } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    sort: 'created',
    direction: 'desc',
  });
  return data;
}

/**
 * Obtém detalhes de uma PR.
 * @param {string} owner
 * @param {string} repo
 * @param {number} prNumber
 * @returns {Promise<Object>}
 */
export async function getPullRequest(owner, repo, prNumber) {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return data;
}

/**
 * Obtém os arquivos alterados em uma PR.
 * @param {string} owner
 * @param {string} repo
 * @param {number} prNumber
 * @returns {Promise<Array>}
 */
export async function getPullRequestFiles(owner, repo, prNumber) {
  const { data } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
  });
  return data;
}

/**
 * Obtém o diff de uma PR como texto.
 * @param {string} owner
 * @param {string} repo
 * @param {number} prNumber
 * @returns {Promise<string>}
 */
export async function getPullRequestDiff(owner, repo, prNumber) {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: 'diff' },
  });
  return data;
}

/**
 * Aprova uma PR.
 * @param {string} owner
 * @param {string} repo
 * @param {number} prNumber
 * @param {string} [comment] - Comentário opcional
 */
export async function approvePullRequest(owner, repo, prNumber, comment = '') {
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    event: 'APPROVE',
    body: comment || undefined,
  });
}

/**
 * Solicita alterações em uma PR.
 * @param {string} owner
 * @param {string} repo
 * @param {number} prNumber
 * @param {string} comment
 */
export async function requestChanges(owner, repo, prNumber, comment) {
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    event: 'REQUEST_CHANGES',
    body: comment,
  });
}

/**
 * Adiciona um comentário em uma PR.
 * @param {string} owner
 * @param {string} repo
 * @param {number} prNumber
 * @param {string} comment
 */
export async function commentOnPR(owner, repo, prNumber, comment) {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: comment,
  });
}

/**
 * Faz merge de uma PR.
 * @param {string} owner
 * @param {string} repo
 * @param {number} prNumber
 * @param {string} method - 'merge', 'squash' ou 'rebase'
 */
export async function mergePullRequest(owner, repo, prNumber, method = 'merge') {
  const { data } = await octokit.rest.pulls.merge({
    owner,
    repo,
    pull_number: prNumber,
    merge_method: method,
  });
  return data;
}

/**
 * Fecha uma PR sem merge.
 * @param {string} owner
 * @param {string} repo
 * @param {number} prNumber
 */
export async function closePullRequest(owner, repo, prNumber) {
  await octokit.rest.pulls.update({
    owner,
    repo,
    pull_number: prNumber,
    state: 'closed',
  });
}