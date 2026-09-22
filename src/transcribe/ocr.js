import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SUPPORTED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.webp', '.bmp',
  '.tiff', '.tif', '.gif',
];

/**
 * Diretório de cache do tesseract.js (fica na pasta do usuário,
 * não no projeto). Evita que arquivos .traineddata apareçam no cwd.
 * @returns {string}
 */
function getTesseractCachePath() {
  return path.join(os.homedir(), '.jarvis-dev', 'tesseract-cache');
}

/**
 * Verifica se o arquivo parece uma imagem suportada (por extensão).
 * @param {string} filePath
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateImageFile(filePath) {
  if (!filePath) {
    return { ok: false, reason: 'Informe o caminho de uma imagem.' };
  }

  const absolute = path.resolve(filePath);

  if (!fs.existsSync(absolute)) {
    return { ok: false, reason: `Arquivo não encontrado: ${absolute}` };
  }

  let stats;
  try {
    stats = fs.statSync(absolute);
  } catch (err) {
    return { ok: false, reason: `Não foi possível ler o arquivo: ${err.message}` };
  }

  if (!stats.isFile()) {
    return { ok: false, reason: 'O caminho não é um arquivo.' };
  }

  const ext = path.extname(absolute).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      reason: `Extensão não suportada (${ext || 'sem extensão'}). Suportadas: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    };
  }

  return { ok: true };
}

/**
 * Carrega o tesseract.js dinamicamente. Se não estiver instalado,
 * lança um erro amigável.
 */
async function loadTesseract() {
  try {
    const mod = await import('tesseract.js');
    return mod.default || mod;
  } catch {
    throw new Error(
      'Esta funcionalidade requer o pacote "tesseract.js".\n' +
      '  Instale com: npm install tesseract.js'
    );
  }
}

/**
 * Extrai o texto de uma imagem usando OCR local (tesseract.js).
 * Sem nenhuma chamada de IA — só extração determinística.
 *
 * @param {string} filePath
 * @param {{ lang?: string, onProgress?: (info: object) => void }} [options]
 * @returns {Promise<{ text: string, confidence: number, language: string }>}
 */
export async function extractTextFromImage(filePath, options = {}) {
  const { lang = 'por+eng', onProgress } = options;
  const absolute = path.resolve(filePath);

  const Tesseract = await loadTesseract();

  // Garante que o diretório de cache existe
  const cachePath = getTesseractCachePath();
  try {
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true });
    }
  } catch {
    // se não conseguir criar, o tesseract tenta o default
  }

  // Monta opções do recognize SEMPRE válidas: o tesseract.js quebra se
  // "logger" vier com valor undefined/null. Só inclui quando for função.
  const recognizeOptions = {
    cachePath,
  };
  if (typeof onProgress === 'function') {
    recognizeOptions.logger = (info) => {
      try {
        onProgress(info);
      } catch {
        // nunca deixa erro do callback derrubar o OCR
      }
    };
  }

  let result;
  try {
    result = await Tesseract.recognize(absolute, lang, recognizeOptions);
  } catch (err) {
    const msg = err?.message || String(err);
    throw new Error(`Falha ao processar a imagem (OCR): ${msg}`);
  }

  const text = (result?.data?.text || '').trim();
  const confidence = typeof result?.data?.confidence === 'number'
    ? result.data.confidence
    : 0;

  return { text, confidence, language: lang };
}

export { SUPPORTED_EXTENSIONS, getTesseractCachePath };