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