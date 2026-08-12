import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Cria um diretório temporário único para o teste.
 * @param {string} [prefix]
 * @returns {string}
 */
export function makeTempDir(prefix = 'jarvis-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Remove diretório recursivamente (best-effort).
 * @param {string} dir
 */
export function removeTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

/**
 * Escreve um arquivo relativo ao cwd de teste.
 * @param {string} cwd
 * @param {string} relativePath
 * @param {string} content
 */
export function writeFile(cwd, relativePath, content) {
  const full = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}
