import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { detectJiraIssueKey } from '../commit/helpers.js';
import { readHistory, appendHistory } from './store.js';

const DEFAULT_LIMIT = 50;

/**
 * Checa se um diretório é um repositório Git (sem depender de process.cwd).
 * @param {string} cwd
 * @returns {boolean}
 */
function isGitRepoAt(cwd) {
  return fs.existsSync(path.join(cwd, '.git'));
}

/**
 * Lê o nome da branch atual em um diretório específico.
 * @param {string} cwd
 * @returns {string|null}
 */
function getBranchAt(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Lê os últimos commits do git log.
 * Usa escapes do git (%x00, %x1e) em vez de bytes literais, porque no
 * Windows o execFileSync não passa null bytes corretamente nos argumentos.
 *
 * @param {number} limit
 * @param {string} cwd
 * @returns {Array<{ hash: string, shortHash: string, author: string, at: string, title: string, body: string }>}
 */
export function getGitCommits(limit, cwd) {
  try {
    const format = '%H%x00%h%x00%an%x00%at%x00%s%x00%b%x1e';
    const out = execFileSync(
      'git',
      ['log', `-${limit}`, `--pretty=format:${format}`],
      { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
    );

    return out
      .split('\x1e')
      .map((r) => r.replace(/^\n+/, '').trim())
      .filter(Boolean)
      .map((record) => {
        const [hash, shortHash, author, at, subject, body] = record.split('\x00');
        return {
          hash: hash || '',
          shortHash: shortHash || '',
          author: author || '',
          at: at ? new Date(Number(at) * 1000).toISOString() : new Date().toISOString(),
          title: subject || '',
          body: (body || '').trim(),
        };
      })
      .filter((c) => c.hash);
  } catch {
    return [];
  }
}

/**
 * Lista os arquivos alterados por um commit.
 * @param {string} hash
 * @param {string} cwd
 * @returns {string[]}
 */
export function getCommitFiles(hash, cwd) {
  if (!hash) return [];
  try {
    const out = execFileSync(
      'git',
      ['show', '--name-only', '--pretty=format:', hash],
      {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 5 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'], // silencia stderr (hash inválido, etc.)
      }
    );
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Sincroniza o histórico local com o git log, adicionando entradas
 * para commits que ainda não estão no histórico (commits manuais).
 *
 * @param {{ limit?: number, cwd?: string, dryRun?: boolean }} [opts]
 * @returns {{ added: number, scanned: number, entries: object[], repo: string|null }}
 */
export function syncHistoryFromGit(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const limit = opts.limit || DEFAULT_LIMIT;
  const dryRun = Boolean(opts.dryRun);

  if (!isGitRepoAt(cwd)) {
    return { added: 0, scanned: 0, entries: [], repo: null };
  }

  const gitCommits = getGitCommits(limit, cwd);
  if (gitCommits.length === 0) {
    return { added: 0, scanned: 0, entries: [], repo: null };
  }

  const existing = readHistory({ limit: 5000, cwd });
  const existingHashes = new Set(existing.map((e) => e.hash).filter(Boolean));

  const branch = getBranchAt(cwd);
  const jiraIssue = detectJiraIssueKey(branch);

  const added = [];

  // Ordem cronológica (mais antigo → mais recente)
  for (const commit of [...gitCommits].reverse()) {
    if (existingHashes.has(commit.hash)) continue;

    const files = getCommitFiles(commit.hash, cwd);

    const entry = {
      action: 'commit',
      source: 'git',
      branch,
      hash: commit.hash,
      title: commit.title,
      body: commit.body,
      files,
      fileCount: files.length,
      pushed: false,
      pushedAt: null,
      at: commit.at,
      jiraIssue,
    };

    if (!dryRun) {
      appendHistory(entry, cwd);
    }
    added.push(entry);
  }

  return {
    added: added.length,
    scanned: gitCommits.length,
    entries: added,
    repo: cwd,
  };
}