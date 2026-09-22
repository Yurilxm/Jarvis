import { detectPorcupine, getPicovoiceAccessKey } from './dependencies.js';
import { readVoiceConfig } from './config.js';

/**
 * Palavras built-in suportadas pelo SDK do Porcupine.
 * Usar built-in evita precisar de arquivo .ppn customizado.
 */
export const BUILTIN_KEYWORDS = [
  'JARVIS',
  'COMPUTER',
  'HEY_GOOGLE',
  'HEY_SIRI',
  'ALEXA',
  'PICOVOICE',
  'PORCUPINE',
  'BUMBLEBEE',
  'GRASSHOPPER',
];

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isBuiltinKeyword(name) {
  return BUILTIN_KEYWORDS.includes(String(name || '').toUpperCase());
}

/**
 * Cria o detector de wake word. Retorna:
 *  - handle do Porcupine
 *  - frameLength esperado
 *  - release() para liberar recursos
 *
 * @param {{
 *   accessKey?: string,
 *   keyword?: string,
 *   keywordPath?: string,
 *   sensitivity?: number,
 * }} [opts]
 * @returns {Promise<{
 *   ok: boolean,
 *   handle?: any,
 *   frameLength?: number,
 *   release?: () => void,
 *   reason?: string,
 * }>}
 */
export async function createWakeWordDetector(opts = {}) {
  const cfg = readVoiceConfig();
  const accessKey = opts.accessKey || getPicovoiceAccessKey();

  if (!accessKey) {
    return {
      ok: false,
      reason:
        'AccessKey do Picovoice não configurada.\n' +
        '  Obtenha uma grátis em https://console.picovoice.ai/\n' +
        '  Depois defina a variável PICOVOICE_ACCESS_KEY no seu .env pessoal\n' +
        '  ou rode: jarvis voz --config',
    };
  }

  const det = await detectPorcupine();
  if (!det.ok) return det;

  const { Porcupine, BuiltinKeyword } = det.module;

  const keywordName = (opts.keyword || cfg.wakeKeyword || 'JARVIS').toUpperCase();
  const keywordPath = opts.keywordPath || cfg.wakeKeywordPath || null;
  const sensitivity = opts.sensitivity ?? cfg.wakeSensitivity ?? 0.5;

  let handle;
  try {
    if (keywordPath) {
      handle = new Porcupine(accessKey, [keywordPath], [sensitivity]);
    } else if (isBuiltinKeyword(keywordName) && BuiltinKeyword && BuiltinKeyword[keywordName]) {
      handle = new Porcupine(accessKey, [BuiltinKeyword[keywordName]], [sensitivity]);
    } else {
      // Fallback: tenta usar o built-in JARVIS se o nome não for reconhecido
      if (!BuiltinKeyword || !BuiltinKeyword.JARVIS) {
        return {
          ok: false,
          reason:
            `Palavra '${keywordName}' não está disponível como built-in.\n` +
            '  Use um .ppn customizado via config (wakeKeywordPath) ou uma das built-ins.',
        };
      }
      handle = new Porcupine(accessKey, [BuiltinKeyword.JARVIS], [sensitivity]);
    }
  } catch (err) {
    return {
      ok: false,
      reason: `Falha ao inicializar Porcupine: ${err.message}`,
    };
  }

  return {
    ok: true,
    handle,
    frameLength: handle.frameLength,
    sampleRate: handle.sampleRate,
    release: () => {
      try { handle.release(); } catch { /* ignore */ }
    },
  };
}

/**
 * Consome um Buffer PCM 16-bit LE e devolve frames do tamanho esperado
 * pelo Porcupine. Mantém sobras internas em um Buffer acumulador.
 *
 * @param {number} frameLength - número de amostras por frame
 * @returns {{ push: (chunk: Buffer) => Int16Array[], flush: () => void }}
 */
export function frameSplitter(frameLength) {
  const bytesPerFrame = frameLength * 2; // 16-bit = 2 bytes
  let leftover = Buffer.alloc(0);

  return {
    push(chunk) {
      const merged = Buffer.concat([leftover, chunk]);
      const frames = [];
      let offset = 0;

      while (merged.length - offset >= bytesPerFrame) {
        const slice = merged.subarray(offset, offset + bytesPerFrame);
        // Copia para um Int16Array estável
        const int16 = new Int16Array(frameLength);
        for (let i = 0; i < frameLength; i++) {
          int16[i] = slice.readInt16LE(i * 2);
        }
        frames.push(int16);
        offset += bytesPerFrame;
      }

      leftover = merged.subarray(offset);
      return frames;
    },
    flush() {
      leftover = Buffer.alloc(0);
    },
  };
}