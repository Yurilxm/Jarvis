import { generateWithGemini } from './gemini.js';

/**
 * Envia um prompt para a IA e retorna a resposta.
 * Esta função não conhece detalhes do provedor.
 *
 * @param {string} prompt - O prompt a ser enviado
 * @returns {Promise<string>} A resposta da IA
 */
export async function askAI(prompt) {
  return generateWithGemini(prompt);
}