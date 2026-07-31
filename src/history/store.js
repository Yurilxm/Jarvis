import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * @param {string} [cwd]
 * @returns {string}
 */
export function getHistoryDir(cwd = process.cwd()) {
  return path.join(cwd, '.jarvis');
}

/**
 * @param {string} [cwd]
 * @returns {string}
 */
export function getHistoryPath(cwd = process.cwd()) {
  return path.join(getHistoryDir(cwd), 'history.jsonl');
}

function ensureHistoryDir(cwd = process.cwd()) {
  const dir = getHistoryDir(cwd);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Registra um evento do Jarvis (commit/push).
 * @param {object} event
 * @param {string} [cwd]
 */
export function appendHistory(event, cwd = process.cwd()) {
  ensureHistoryDir(cwd);

  const entry = {
    id: event.id || randomUUID(),
    at: event.at || new Date().toISOString(),
    action: event.action || 'commit',
    repo: event.repo || path.basename(cwd),
    cwd: event.cwd || cwd,
    branch: event.branch || null,
    hash: event.hash || null,
    title: event.title || '',
    body: event.body || '',
    files: event.files || [],
    fileCount: event.fileCount ?? (event.files?.length || 0),
    pushed: Boolean(event.pushed),
    pushedAt: event.pushedAt || null,
  };

  fs.appendFileSync(getHistoryPath(cwd), `${JSON.stringify(entry)}\n`, 'utf-8');
  return entry;
}

/**
 * Lê o histórico (mais recente primeiro).
 * @param {{ limit?: number, pushedOnly?: boolean, cwd?: string }} [options]
 * @returns {object[]}
 */
export function readHistory({ limit = 50, pushedOnly = false, cwd = process.cwd() } = {}) {
  const filePath = getHistoryPath(cwd);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const lines = fs.readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // linha corrompida — ignora
    }
  }

  let list = entries.reverse();
  if (pushedOnly) {
    list = list.filter((e) => e.pushed);
  }

  return list.slice(0, limit);
}

/**
 * Busca um evento por id ou hash curto.
 * @param {string} query
 * @param {string} [cwd]
 */
export function findHistoryEntry(query, cwd = process.cwd()) {
  const all = readHistory({ limit: 1000, cwd });
  const q = query.toLowerCase();
  return all.find(
    (e) =>
      e.id === query ||
      e.hash === query ||
      (e.hash && e.hash.startsWith(query)) ||
      (e.title && e.title.toLowerCase().includes(q))
  ) || null;
}
