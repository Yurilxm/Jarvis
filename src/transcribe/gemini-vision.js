import fs from 'node:fs';
import path from 'node:path';
import { askAIMultimodal } from '../ai/client.js';

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.gif': 'image/gif',
};

/**
 * Mapeia extensão → mime type. Função pura — testável.
 * @param {string} filePath
 * @returns {string|null}
 */
export function getMimeType(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  return MIME_MAP[ext] || null;
}

const OCR_PROMPT = `Você é um transcritor profissional. Extraia TODO o texto visível nesta imagem, mantendo fielmente:
- O conteúdo literal (mesmo que seja manuscrito, cursivo, torto ou borrado)
- A ordem de leitura natural
- Quebras de linha onde houver
- Pontuação e acentuação corretas

Regras:
1. NÃO traduza, NÃO resuma, NÃO interprete. Apenas transcreva.
2. NÃO adicione comentários, explicações ou prefixos.
3. Se houver palavras ilegíveis, marque com [?] naquele ponto.
4. Se a imagem estiver de cabeça para baixo ou girada, corrija mentalmente antes de transcrever.
5. Preserve a estrutura (parágrafos, listas, versos).

Retorne APENAS o texto transcrito.`;

/**
 * Extrai texto de uma imagem usando Gemini Vision.
 *
 * @param {string} imagePath
 * @returns {Promise<{ text: string, engine: 'gemini-vision' }>}
 */
export async function extractTextWithGemini(imagePath) {
  const absolute = path.resolve(imagePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Arquivo não encontrado: ${absolute}`);
  }

  const mimeType = getMimeType(absolute);
  if (!mimeType) {
    throw new Error(
      `Tipo de imagem não suportado para IA: ${path.extname(absolute) || '(sem extensão)'}`
    );
  }

  let data;
  try {
    const buffer = fs.readFileSync(absolute);
    data = buffer.toString('base64');
  } catch (err) {
    throw new Error(`Falha ao ler a imagem: ${err.message}`);
  }

  const text = await askAIMultimodal([
    { text: OCR_PROMPT },
    { inlineData: { mimeType, data } },
  ]);

  return { text: text.trim(), engine: 'gemini-vision' };
}