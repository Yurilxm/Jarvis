/**
 * Carrega o clipboardy dinamicamente. Se não estiver instalado,
 * lança um erro amigável.
 */
async function loadClipboardy() {
  try {
    const mod = await import('clipboardy');
    return mod.default || mod;
  } catch {
    throw new Error(
      'Copiar para a área de transferência requer o pacote "clipboardy".\n' +
      '  Instale com: npm install clipboardy'
    );
  }
}

/**
 * Copia um texto para a área de transferência.
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
  const clipboard = await loadClipboardy();
  await clipboard.write(text);
}