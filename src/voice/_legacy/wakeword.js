/**
 * ⚠️  LEGACY / EXPERIMENTAL — Porcupine (Picovoice)
 *
 * Este módulo usa o SDK do Porcupine para wake word. Ele está mantido aqui
 * por compatibilidade, mas NÃO é o caminho principal do Jarvis Voz.
 *
 * Motivo:
 *  - A Picovoice fechou o free tier do console para e-mails pessoais
 *  - Sem conta paga, a AccessKey não pode ser gerada
 *  - O modo `jarvis voz --wake` só funciona com conta paga
 *
 * O que vai substituir:
 *  - Vosk (open source, offline, sem conta) — ver etapa E do roadmap
 *  - O Vosk também faz keyword spotting local e não precisa de API key
 *
 * Se você tem conta paga na Picovoice e quer usar mesmo assim:
 *  1. Gere uma AccessKey em https://console.picovoice.ai/
 *  2. Defina PICOVOICE_ACCESS_KEY no ~/.jarvis-dev/.env
 *  3. Rode: jarvis voz --wake
 *
 * Não remova este arquivo: `frameSplitter` é reaproveitado em outras partes
 * do pipeline de áudio. Quando o Vosk for implementado, esta pasta pode ser
 * deletada inteira.
 */

import { detectPorcupine, getPicovoiceAccessKey } from '../dependencies.js';
import { readVoiceConfig } from '../config.js';

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
        '  ⚠️  O free tier da Picovoice foi fechado para e-mails pessoais.\n' +
        '  Este modo só funciona com conta paga em https://console.picovoice.ai/.\n' +
        '  O Vosk (wake word open source) substituirá o Porcupine em breve.\n' +
        '  Se você tem conta paga, defina PICOVOICE_ACCESS_KEY no ~/.jarvis-dev/.env',
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
 * NOTA: apesar do nome "Porcupine", esta função é genérica — qualquer
 * sistema baseado em frames PCM (Vosk, outros) pode reusar.
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