import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeWavFile, rmsLevel } from './wav.js';

/**
 * Grava uma "frase de comando" a partir de um stream PCM 16-bit LE.
 * Para quando:
 *  - passou `maxDurationMs` (padrão 8s), ou
 *  - detectou silêncio por `silenceMs` (padrão 1.5s) após ter havido som,
 *    e já houve pelo menos `minVoiceMs` de voz detectada.
 *
 * @param {NodeJS.ReadableStream} stream
 * @param {number} sampleRate
 * @param {{ maxDurationMs?: number, silenceMs?: number, minVoiceMs?: number }} [opts]
 * @returns {Promise<{ path: string, hadVoice: boolean, durationMs: number }>}
 */
export function captureCommandPhrase(stream, sampleRate, opts = {}) {
  const maxDurationMs = opts.maxDurationMs ?? 8000;
  const silenceMs = opts.silenceMs ?? 1500;
  const minVoiceMs = opts.minVoiceMs ?? 300;

  return new Promise((resolve, reject) => {
    const chunks = [];
    const start = Date.now();
    let lastVoiceAt = null;
    let totalVoiceMs = 0;

    const frameMs = 100;
    const bytesPerWindow = Math.floor(sampleRate * 2 * (frameMs / 1000));
    let carry = Buffer.alloc(0);

    const cleanup = () => {
      stream.removeListener('data', onData);
      stream.removeListener('error', onError);
    };

    const finish = () => {
      cleanup();
      const pcm = Buffer.concat(chunks);
      const outPath = path.join(os.tmpdir(), 'jarvis-voz', `cmd-${Date.now()}.wav`);
      if (!fs.existsSync(path.dirname(outPath))) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
      }
      writeWavFile(outPath, pcm, { sampleRate });
      const durationMs = Date.now() - start;
      resolve({
        path: outPath,
        hadVoice: totalVoiceMs >= minVoiceMs,
        durationMs,
      });
    };

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    const onData = (chunk) => {
      chunks.push(chunk);
      carry = Buffer.concat([carry, chunk]);

      while (carry.length >= bytesPerWindow) {
        const win = carry.subarray(0, bytesPerWindow);
        carry = carry.subarray(bytesPerWindow);

        const level = rmsLevel(win);
        const now = Date.now();

        if (level > 0.02) {
          lastVoiceAt = now;
          totalVoiceMs += frameMs;
        }

        const elapsed = now - start;
        const silentFor = lastVoiceAt ? now - lastVoiceAt : 0;

        if (totalVoiceMs >= minVoiceMs && silentFor >= silenceMs) {
          finish();
          return;
        }
        if (elapsed >= maxDurationMs) {
          finish();
          return;
        }
      }
    };

    stream.on('data', onData);
    stream.on('error', onError);
  });
}