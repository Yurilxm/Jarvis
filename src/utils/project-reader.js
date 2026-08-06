import fs from 'node:fs';
import path from 'node:path';

const MAX_FILE_SIZE = 200 * 1024; // 200KB
const MAX_LINES_PER_FILE = 200;

const IGNORE_PATTERNS = [
  /node_modules/, /venv/, /\.venv/, /__pycache__/, /migrations/,
  /staticfiles/, /media/, /\.git/, /\.env$/, /db\.sqlite3$/,
  /\.jpg$/, /\.png$/, /\.gif$/, /\.ico$/, /\.woff/, /\.ttf/, /\.eot/,
  /package-lock\.json/,
];

export function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(p => p.test(filePath));
}

export function getDirectoryTree(rootDir, depth = 3, currentDepth = 0) {
  if (currentDepth > depth) return '';
  let result = '';
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath);
      if (shouldIgnore(relativePath)) continue;
      
      if (entry.isDirectory()) {
        result += '  '.repeat(currentDepth) + `📁 ${entry.name}/\n`;
        result += getDirectoryTree(fullPath, depth, currentDepth + 1);
      } else {
        result += '  '.repeat(currentDepth) + `📄 ${entry.name}\n`;
      }
    }
  } catch { /* permissão */ }
  return result;
}

export function getKeyFiles(rootDir, extensions) {
  const candidates = [];
  
  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);
        if (shouldIgnore(relativePath)) continue;
        
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          const stats = fs.statSync(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext) && stats.size < MAX_FILE_SIZE) {
            candidates.push({ path: fullPath, size: stats.size });
          }
        }
      }
    } catch { /* permissão */ }
  }
  
  walk(rootDir);
  candidates.sort((a, b) => b.size - a.size);
  return candidates.slice(0, 15);
}

export function readFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    return lines.length <= MAX_LINES_PER_FILE ? content : lines.slice(0, MAX_LINES_PER_FILE).join('\n') + '\n... (truncado)';
  } catch {
    return '[Erro ao ler arquivo]';
  }
}