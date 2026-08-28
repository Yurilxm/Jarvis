import fs from 'node:fs';
import path from 'node:path';

const MAX_FILE_SIZE = 200 * 1024; // 200KB
const MAX_LINES_PER_FILE = 200;

const IGNORE_PATTERNS = [
  /node_modules/, /venv/, /\.venv/, /__pycache__/, /migrations/,
  /staticfiles/, /media/, /\.git/, /\.env$/, /db\.sqlite3$/,
  /\.jpg$/, /\.png$/, /\.gif$/, /\.ico$/, /\.woff/, /\.ttf/, /\.eot/,
  /package-lock\.json/, /\.min\.js$/, /\.min\.css$/,
];

// Nomes de arquivo que quase sempre carregam a lógica central do projeto,
// independente do tamanho. Quanto menor o índice, maior a prioridade.
const HIGH_PRIORITY_NAMES = [
  'settings.py', 'urls.py', 'models.py', 'views.py', 'serializers.py',
  'admin.py', 'forms.py', 'apps.py',
  'main.py', 'app.py', 'server.js', 'index.js', 'index.ts',
  'schema.py', 'routes.py',
];

// Arquivos que sinalizam "isto é um módulo/app" quando presentes numa pasta.
const MODULE_ANCHOR_FILES = ['models.py', 'index.js', 'index.ts', 'controller.js', 'routes.py'];

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

/**
 * Calcula uma pontuação de prioridade para um arquivo.
 * Menor = mais prioritário. Arquivos de nome conhecido (models.py, views.py etc.)
 * vêm sempre antes de qualquer outro critério, independente do tamanho.
 */
function priorityScore(filePath) {
  const name = path.basename(filePath).toLowerCase();
  const nameIndex = HIGH_PRIORITY_NAMES.indexOf(name);
  if (nameIndex !== -1) return nameIndex;
  return HIGH_PRIORITY_NAMES.length;
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

  candidates.sort((a, b) => {
    const scoreA = priorityScore(a.path);
    const scoreB = priorityScore(b.path);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.size - b.size;
  });

  return candidates.slice(0, 30);
}

/**
 * Detecta subpastas que representam módulos/apps do projeto (contêm um
 * arquivo âncora como models.py, index.js, etc.), até uma profundidade razoável.
 */
export function getModules(rootDir, maxDepth = 3) {
  const modules = [];

  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const hasAnchor = entries.some(
      (e) => e.isFile() && MODULE_ANCHOR_FILES.includes(e.name)
    );
    const relativePath = path.relative(rootDir, dir);

    if (hasAnchor && relativePath && !shouldIgnore(relativePath)) {
      modules.push(dir);
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, fullPath);
      if (shouldIgnore(relPath)) continue;
      if (entry.isDirectory()) walk(fullPath, depth + 1);
    }
  }

  walk(rootDir, 0);
  return modules;
}

/**
 * Como getKeyFiles, mas garante que cada módulo detectado contribua com
 * pelo menos alguns arquivos, em vez de um módulo dominar a lista inteira.
 */
export function getKeyFilesByModule(rootDir, extensions, filesPerModule = 4) {
  const modules = getModules(rootDir);
  const result = [];

  // Sem módulos detectados (projeto pequeno/flat) — cai no comportamento antigo.
  if (modules.length === 0) {
    return getKeyFiles(rootDir, extensions);
  }

  for (const moduleDir of modules) {
    const filesInModule = [];
    try {
      const entries = fs.readdirSync(moduleDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!extensions.includes(ext)) continue;
        const fullPath = path.join(moduleDir, entry.name);
        const stats = fs.statSync(fullPath);
        if (stats.size < MAX_FILE_SIZE) {
          filesInModule.push({ path: fullPath, size: stats.size });
        }
      }
    } catch { /* permissão */ }

    filesInModule.sort((a, b) => {
      const sa = priorityScore(a.path);
      const sb = priorityScore(b.path);
      return sa !== sb ? sa - sb : a.size - b.size;
    });

    result.push(...filesInModule.slice(0, filesPerModule));
  }

  // Arquivos de raiz (settings.py, urls.py principal, package.json) não
  // pertencem a nenhum módulo específico — inclui separadamente.
  const rootFiles = getKeyFiles(rootDir, extensions).filter(
    (f) => !modules.some((m) => f.path.startsWith(m + path.sep))
  );

  return [...rootFiles.slice(0, 8), ...result];
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