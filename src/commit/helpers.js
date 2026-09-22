/**
 * Remove caminhos internos do Jarvis (.jarvis/) da lista.
 * @param {string[]} files
 * @returns {string[]}
 */
export function filterInternalPaths(files) {
  return files.filter((file) => !file.replace(/\\/g, '/').startsWith('.jarvis/'));
}

/**
 * Verifica se devemos sugerir release automático do Jarvis.
 * @param {string} remoteUrl
 * @param {string} commitType
 * @returns {boolean}
 */
export function shouldSuggestJarvisRelease(remoteUrl, commitType) {
  const isJarvisRepo = remoteUrl.includes('Yurilxm/Jarvis') || remoteUrl.includes('kayomacedo/Jarvis');
  const isFeatOrFix = commitType === 'feat' || commitType === 'fix';
  return isJarvisRepo && isFeatOrFix;
}

/**
 * Extrai a chave de uma issue do Jira a partir do nome de uma branch.
 * Ex: "feature/SDG-71-descricao" → "SDG-71"
 *     "bugfix/JARVIS-123"        → "JARVIS-123"
 *     "SDG-123-nova-feature"     → "SDG-123"
 * Retorna null se não houver chave.
 * @param {string|null|undefined} branchName
 * @returns {string|null}
 */
export function detectJiraIssueKey(branchName) {
  if (!branchName) return null;
  const match = String(branchName).match(/([A-Z][A-Z0-9]+-\d+)/);
  return match ? match[1] : null;
}