import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isGitRepo } from '../git/status.js';
import { askAI } from '../ai/client.js';
import { buildIgnoreSuggestPrompt } from './promptBuilder.js';
import { getIgnoreInventory } from '../config/ignore.js';

/**
 * Coleta caminhos de arquivos do projeto para análise.
 * @param {string} [cwd]
 * @param {number} [limit]
 * @returns {string[]}
 */
export function collectProjectPaths(cwd = process.cwd(), limit = 250) {
  if (isGitRepo()) {
    try {
      const tracked = execFileSync('git', ['ls-files'], {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 5 * 1024 * 1024,
      });
      const others = execFileSync(
        'git',
        ['ls-files', '--others', '--exclude-standard'],
        { cwd, encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
      );

      const paths = `${tracked}\n${others}`
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      return [...new Set(paths)].slice(0, limit);
    } catch {
      // fallback abaixo
    }
  }

  return walkFiles(cwd, limit);
}

function walkFiles(root, limit, dir = root, acc = []) {
  if (acc.length >= limit) return acc;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    if (acc.length >= limit) break;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;

    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      walkFiles(root, limit, full, acc);
    } else {
      acc.push(rel);
    }
  }

  return acc;
}

/**
 * Pede sugestões de ignore à IA e filtra o que já está ativo.
 * @param {string} [cwd]
 * @returns {Promise<string[]>}
 */
export async function suggestIgnorePatterns(cwd = process.cwd()) {
  const paths = collectProjectPaths(cwd);
  if (paths.length === 0) {
    return [];
  }

  const prompt = buildIgnoreSuggestPrompt(paths);
  let response;
  try {
    response = await askAI(prompt);
  } catch {
    return [];
  }
  const { allActive } = getIgnoreInventory(cwd);
  const active = new Set(allActive);

  const suggestions = response
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s+/, ''))
    .map((line) => line.replace(/^`+|`+$/g, ''))
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('```'))
    .filter((line) => !active.has(line));

  return [...new Set(suggestions)].slice(0, 20);
}
