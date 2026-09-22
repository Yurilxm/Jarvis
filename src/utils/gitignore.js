import fs from 'node:fs';
import path from 'node:path';

/**
 * Garante que uma entrada esteja no .gitignore do projeto (cwd).
 * Se o .gitignore não existir, cria. Se a entrada já estiver presente,
 * não faz nada. Aceita "reports" ou "reports/" — normaliza.
 *
 * @param {string} entry - entrada a garantir (ex: "reports/")
 * @param {string} [cwd]
 * @returns {{ added: boolean, created: boolean }}
 */
export function ensureGitignoreEntry(entry, cwd = process.cwd()) {
  const gitignorePath = path.join(cwd, '.gitignore');
  const normalized = entry.endsWith('/') ? entry : `${entry}/`;
  const bare = normalized.replace(/\/$/, '');

  let content = '';
  let created = false;

  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  } else {
    created = true;
  }

  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const variants = new Set([normalized, bare, `/${bare}`, `/${normalized}`]);
  const already = lines.some((line) => variants.has(line));

  if (already) {
    return { added: false, created: false };
  }

  const suffix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  const block = `${suffix}\n# Jarvis — gerado automaticamente\n${normalized}\n`;

  fs.writeFileSync(gitignorePath, content + block, 'utf-8');

  return { added: true, created };
}