import fs from 'node:fs';
import path from 'node:path';
import { runLocalOcr } from './ocr-local.js';
import { extractTextWithGemini, getMimeType } from './gemini-vision.js';

const SUPPORTED_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.webp', '.bmp',
  '.tiff', '.tif', '.gif',
];

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
 * Extrai texto usando OCR local (RapidOCR via Python).
 * @param {string} imagePath
 * @returns {object}
 */
export function extractTextWithLocal(imagePath) {
  return runLocalOcr(imagePath);
}

// Reexports úteis para o flow
export { extractTextWithGemini, getMimeType };

/**
 * Orquestrador. Modos:
 *  - 'auto'  (padrão): roda local; retorna needsAI se confiança baixa
 *                      OU qualidade ruim
 *  - 'local' : só local
 *  - 'ia'    : só IA (Gemini Vision)
 *
 * @param {string} imagePath
 * @param {{ mode?: 'auto'|'local'|'ia' }} [options]
 * @returns {Promise<object>}
 */
export async function extractTextFromImage(imagePath, options = {}) {
  const mode = options.mode || 'auto';

  if (mode === 'ia') {
    const result = await extractTextWithGemini(imagePath);
    return {
      text: result.text,
      lines: [],
      confidence: null,
      quality: null,
      engine: 'gemini-vision',
      needsAI: false,
    };
  }

  const local = runLocalOcr(imagePath);

  if (mode === 'local') {
    return { ...local, needsAI: false };
  }

  // auto: decide se vale oferecer IA
  const needsAI = shouldOfferAI(local.confidence, local.quality);
  return { ...local, needsAI };
}

// Importado do ocr-local para o orquestrador usar
import { shouldOfferAI } from './ocr-local.js';

export { SUPPORTED_EXTENSIONS };