import { isIgnored, filterIgnoredFiles, loadIgnore } from '../config/ignore.js';

// Padrões de conteúdo suspeito no diff (segunda camada, após o ignore de arquivos)
const SENSITIVE_PATTERNS = [
  /-----BEGIN.*PRIVATE KEY-----/,
  /-----BEGIN RSA PRIVATE KEY-----/,
  /-----BEGIN OPENSSH PRIVATE KEY-----/,
  /(api_key|apikey|api-key)\s*[=:]\s*['"][A-Za-z0-9_\-]{20,}['"]/i,
  /(secret|token|password)\s*[=:]\s*['"][^'"]+['"]/i,
  /ghp_[A-Za-z0-9]{36}/,
  /gho_[A-Za-z0-9]{36}/,
  /ghu_[A-Za-z0-9]{36}/,
  /ghs_[A-Za-z0-9]{36}/,
  /ghr_[A-Za-z0-9]{36}/,
  /sk-[A-Za-z0-9]{48}/,
  /AQ\.[A-Za-z0-9_\-]{20,}/,
];

/**
 * Verifica se um caminho de arquivo é sensível / ignorado.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isSensitiveFile(filePath) {
  return isIgnored(filePath);
}

/**
 * Remove trechos com conteúdo sensível do diff.
 *
 * @param {string} diffContent
 * @returns {{ sanitized: string, warnings: string[] }}
 */
export function sanitizeDiff(diffContent) {
  const warnings = [];
  let sanitized = diffContent;

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push(`Conteúdo sensível detectado e removido (padrão: ${pattern})`);
      sanitized = sanitized.replace(pattern, '[REMOVIDO - CONTEÚDO SENSÍVEL]');
    }
  }

  return { sanitized, warnings };
}

/**
 * Filtra arquivos ignorados / sensíveis da lista.
 * @param {string[]} files
 * @returns {{ safe: string[], blocked: string[], ignoreSource?: string }}
 */
export function filterSensitiveFiles(files) {
  return filterIgnoredFiles(files);
}

export { loadIgnore, filterIgnoredFiles, isIgnored };
