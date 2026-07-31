import { GEMINI_API_KEY, GEMINI_MODEL } from '../config/env.js';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Envia um prompt para a API Gemini e retorna a resposta.
 *
 * @param {string} prompt - Texto do prompt
 * @returns {Promise<string>} Texto gerado pelo modelo
 */
export async function generateWithGemini(prompt) {
  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API Gemini (status ${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Resposta da Gemini não contém texto válido');
  }

  return text;
}