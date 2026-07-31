import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';

/**
 * Padrões padrão (estilo .gitignore) — aplicados salvo se desativados no .jarvisignore.
 */
export const DEFAULT_IGNORE_PATTERNS = [
  '.env',
  '.env.*',
  '.jarvis/',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  'id_rsa',
  'id_rsa.*',
  'id_ed25519',
  'id_ed25519.*',
  '*credentials*',
  '*secret*',
  '*password*',
  '**/secrets/**',
  '**/credentials/**',
  '*.keystore',
  'service-account*.json',
  '*-service-account.json',
];

const DISABLE_PREFIX = '# @disable ';

/**
 * @param {string} [cwd]
 * @returns {string}
 */
export function getJarvisIgnorePath(cwd = process.cwd()) {
  return path.join(cwd, '.jarvisignore');
}

/**
 * Lê e interpreta o .jarvisignore do projeto.
 * @param {string} [cwd]
 * @returns {{ custom: string[], disabledDefaults: string[], rawLines: string[] }}
 */
export function readJarvisIgnore(cwd = process.cwd()) {
  const filePath = getJarvisIgnorePath(cwd);
  if (!fs.existsSync(filePath)) {
    return { custom: [], disabledDefaults: [], rawLines: [] };
  }

  const rawLines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  const custom = [];
  const disabledDefaults = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith(DISABLE_PREFIX.trim()) || trimmed.startsWith('# @disable ')) {
      const pattern = trimmed.replace(/^#\s*@disable\s+/, '').trim();
      if (pattern) disabledDefaults.push(pattern);
      continue;
    }

    if (trimmed.startsWith('#')) continue;
    custom.push(trimmed);
  }

  return { custom, disabledDefaults, rawLines };
}

/**
 * Inventário completo para o menu.
 * @param {string} [cwd]
 */
export function getIgnoreInventory(cwd = process.cwd()) {
  const { custom, disabledDefaults } = readJarvisIgnore(cwd);
  const disabled = new Set(disabledDefaults);

  const activeDefaults = DEFAULT_IGNORE_PATTERNS.filter((p) => !disabled.has(p));
  const inactiveDefaults = DEFAULT_IGNORE_PATTERNS.filter((p) => disabled.has(p));

  return {
    activeDefaults,
    inactiveDefaults,
    custom,
    allActive: [...activeDefaults, ...custom],
  };
}

/**
 * Reescreve o .jarvisignore a partir do estado atual.
 * @param {{ custom: string[], disabledDefaults: string[] }} state
 * @param {string} [cwd]
 */
export function writeJarvisIgnoreState(state, cwd = process.cwd()) {
  const lines = [
    '# .jarvisignore — gerenciado pelo Jarvis (jarvis ignore)',
    '# Sintaxe igual ao .gitignore',
    '',
  ];

  if (state.disabledDefaults.length > 0) {
    lines.push('# Defaults desativados (não remova o prefixo @disable à mão se puder evitar)');
    for (const pattern of state.disabledDefaults) {
      lines.push(`${DISABLE_PREFIX}${pattern}`);
    }
    lines.push('');
  }

  if (state.custom.length > 0) {
    lines.push('# Padrões do projeto');
    for (const pattern of state.custom) {
      lines.push(pattern);
    }
    lines.push('');
  }

  fs.writeFileSync(getJarvisIgnorePath(cwd), lines.join('\n'), 'utf-8');
}

/**
 * Adiciona padrões customizados (ignora duplicados).
 * @param {string[]} patterns
 * @param {string} [cwd]
 * @returns {string[]} padrões realmente adicionados
 */
export function addIgnorePatterns(patterns, cwd = process.cwd()) {
  const state = readJarvisIgnore(cwd);
  const added = [];

  for (const raw of patterns) {
    const pattern = raw.trim();
    if (!pattern || pattern.startsWith('#')) continue;

    if (state.disabledDefaults.includes(pattern)) {
      state.disabledDefaults = state.disabledDefaults.filter((p) => p !== pattern);
      added.push(pattern);
      continue;
    }

    if (DEFAULT_IGNORE_PATTERNS.includes(pattern) || state.custom.includes(pattern)) {
      continue;
    }

    state.custom.push(pattern);
    added.push(pattern);
  }

  writeJarvisIgnoreState(state, cwd);
  return added;
}

/**
 * Remove padrões: custom do arquivo, ou desativa default.
 * @param {string[]} patterns
 * @param {string} [cwd]
 * @returns {{ removedCustom: string[], disabledDefaults: string[] }}
 */
export function removeIgnorePatterns(patterns, cwd = process.cwd()) {
  const state = readJarvisIgnore(cwd);
  const removedCustom = [];
  const newlyDisabled = [];

  for (const raw of patterns) {
    const pattern = raw.trim();
    if (!pattern) continue;

    if (state.custom.includes(pattern)) {
      state.custom = state.custom.filter((p) => p !== pattern);
      removedCustom.push(pattern);
      continue;
    }

    if (DEFAULT_IGNORE_PATTERNS.includes(pattern) && !state.disabledDefaults.includes(pattern)) {
      state.disabledDefaults.push(pattern);
      newlyDisabled.push(pattern);
    }
  }

  writeJarvisIgnoreState(state, cwd);
  return { removedCustom, disabledDefaults: newlyDisabled };
}

/**
 * Reativa um default previamente desativado.
 * @param {string[]} patterns
 * @param {string} [cwd]
 */
export function restoreDefaultPatterns(patterns, cwd = process.cwd()) {
  const state = readJarvisIgnore(cwd);
  const restored = [];

  for (const raw of patterns) {
    const pattern = raw.trim();
    if (state.disabledDefaults.includes(pattern)) {
      state.disabledDefaults = state.disabledDefaults.filter((p) => p !== pattern);
      restored.push(pattern);
    }
  }

  writeJarvisIgnoreState(state, cwd);
  return restored;
}

/**
 * Carrega o matcher de ignore (defaults ativos + .jarvisignore).
 * @param {string} [cwd]
 * @returns {import('ignore').Ignore}
 */
export function loadIgnore(cwd = process.cwd()) {
  const ig = ignore();
  const { activeDefaults, custom } = getIgnoreInventory(cwd);
  ig.add(activeDefaults);
  ig.add(custom);
  return ig;
}

/**
 * Normaliza path para matching estilo gitignore.
 * @param {string} filePath
 * @returns {string}
 */
export function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Verifica se o arquivo deve ser ignorado pelo Jarvis.
 * @param {string} filePath
 * @param {import('ignore').Ignore} [ig]
 * @returns {boolean}
 */
export function isIgnored(filePath, ig = loadIgnore()) {
  return ig.ignores(normalizePath(filePath));
}

/**
 * Separa arquivos em safe / blocked conforme a lista de ignore.
 * @param {string[]} files
 * @param {string} [cwd]
 * @returns {{ safe: string[], blocked: string[], ignoreSource: string }}
 */
export function filterIgnoredFiles(files, cwd = process.cwd()) {
  const ig = loadIgnore(cwd);
  const filePath = getJarvisIgnorePath(cwd);
  const ignoreSource = fs.existsSync(filePath)
    ? 'defaults + .jarvisignore'
    : 'defaults';

  const safe = [];
  const blocked = [];

  for (const file of files) {
    if (isIgnored(file, ig)) {
      blocked.push(file);
    } else {
      safe.push(file);
    }
  }

  return { safe, blocked, ignoreSource };
}
