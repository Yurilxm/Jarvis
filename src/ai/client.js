import { generateWithGemini, generateWithGeminiParts } from './gemini.js';

/**
 * Envia um prompt de texto para a IA e retorna a resposta.
 * Esta função não conhece detalhes do provedor.
 *
 * @param {string} prompt - O prompt a ser enviado
 * @returns {Promise<string>} A resposta da IA
 */
export async function askAI(prompt) {
  return generateWithGemini(prompt);
}

/**
 * Envia um prompt multimodal (texto + imagens / anexos).
 * `parts` segue o formato da API Gemini:
 *   [{ text: "..." }, { inlineData: { mimeType, data } }]
 *
 * @param {Array<object>} parts
 * @returns {Promise<string>}
 */
export async function askAIMultimodal(parts) {
  return generateWithGeminiParts(parts);
}