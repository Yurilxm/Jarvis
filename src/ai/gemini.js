import { GEMINI_API_KEY, GEMINI_MODEL } from '../config/env.js';
import { checkUsage, incrementUsage } from './usage-tracker.js';
import { warn } from '../ui.js';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const QUOTA_EXCEEDED_STATUS = 429;
const INITIAL_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 60000; // imagens grandes podem demorar

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatErrorMessage(status, bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    const apiMessage = parsed?.error?.message || bodyText;
    const retryMatch = apiMessage.match(/retry in (\d+(?:\.\d+)?)s/i);
    const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;

    let message = `Erro na API Gemini (status ${status}): ${apiMessage}`;
    if (status === QUOTA_EXCEEDED_STATUS) {
      message = `Cota da Gemini excedida. Aguarde${retrySeconds ? ` ${retrySeconds}s` : ' alguns minutos'} ou verifique seu plano em https://ai.google.dev/gemini-api/docs/rate-limits`;
    }

    return { message, retrySeconds };
  } catch {
    return {
      message: `Erro na API Gemini (status ${status}): ${bodyText}`,
      retrySeconds: null,
    };
  }
}

/**
 * Envia `parts` (multimodal ou texto) para a API Gemini.
 * Aceita array de parts no formato da API:
 *   [{ text: "..." }, { inlineData: { mimeType, data } }]
 *
 * @param {Array<object>} parts
 * @returns {Promise<string>}
 */
export async function generateWithGeminiParts(parts) {
  const before = await checkUsage();
  if (before.warning) {
    warn(before.warning);
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error('Resposta da Gemini não contém texto válido');
        }

        const after = await incrementUsage();
        if (after.warning) {
          warn(after.warning);
        }

        return text;
      }

      const errorText = await response.text();
      const status = response.status;
      const { message: friendlyMessage, retrySeconds } = formatErrorMessage(status, errorText);

      if (status === QUOTA_EXCEEDED_STATUS) {
        lastError = new Error(friendlyMessage);
        break;
      }

      if (RETRYABLE_STATUSES.has(status) && attempt < MAX_RETRIES) {
        const delay = retrySeconds
          ? retrySeconds * 1000
          : INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
        warn(`API Gemini sobrecarregada (${status}). Tentando novamente em ${Math.ceil(delay / 1000)}s...`);
        await sleep(delay);
        lastError = new Error(friendlyMessage);
        continue;
      }

      lastError = new Error(friendlyMessage);
      break;
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError' && attempt < MAX_RETRIES) {
        const delay = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
        warn(`Tempo limite excedido. Tentando novamente em ${delay / 1000}s...`);
        await sleep(delay);
        lastError = new Error('Tempo limite excedido ao comunicar com a API Gemini.');
        continue;
      }

      if (fetchErr.name === 'AbortError') {
        lastError = new Error('Tempo limite excedido ao comunicar com a API Gemini.');
      } else {
        lastError = fetchErr;
      }
      break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

/**
 * Envia um prompt de texto puro.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function generateWithGemini(prompt) {
  return generateWithGeminiParts([{ text: prompt }]);
}