// Padrões de arquivos que nunca devem ser enviados para a IA
const SENSITIVE_FILES = [
  /\.env(\..*)?$/,
  /credentials/i,
  /secret/i,
  /token/i,
  /\.pem$/,
  /id_rsa/,
  /\.key$/,
  /password/i,
];

// Padrões de conteúdo suspeito no diff
const SENSITIVE_PATTERNS = [
  /-----BEGIN.*PRIVATE KEY-----/,
  /-----BEGIN RSA PRIVATE KEY-----/,
  /-----BEGIN OPENSSH PRIVATE KEY-----/,
  /(api_key|apikey|api-key)\s*[=:]\s*['"][A-Za-z0-9_\-]{20,}['"]/i,
  /(secret|token|password)\s*[=:]\s*['"][^'"]+['"]/i,
  /ghp_[A-Za-z0-9]{36}/,  // Token GitHub
  /gho_[A-Za-z0-9]{36}/,
  /ghu_[A-Za-z0-9]{36}/,
  /ghs_[A-Za-z0-9]{36}/,
  /ghr_[A-Za-z0-9]{36}/,
  /sk-[A-Za-z0-9]{48}/,   // Chave OpenAI
];

/**
 * Verifica se um caminho de arquivo é sensível.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isSensitiveFile(filePath) {
  return SENSITIVE_FILES.some(pattern => pattern.test(filePath));
}

/**
 * Remove linhas com conteúdo sensível do diff.
 * Em vez de bloquear tudo, remove apenas as linhas perigosas e adiciona um aviso.
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
 * Filtra arquivos sensíveis da lista de arquivos.
 * @param {string[]} files
 * @returns {{ safe: string[], blocked: string[] }}
 */
export function filterSensitiveFiles(files) {
  const safe = [];
  const blocked = [];

  for (const file of files) {
    if (isSensitiveFile(file)) {
      blocked.push(file);
    } else {
      safe.push(file);
    }
  }

  return { safe, blocked };
}