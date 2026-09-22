import fs from 'node:fs';

/**
 * Escreve um arquivo WAV PCM 16-bit a partir de um Buffer de amostras.
 *
 * @param {string} outputPath
 * @param {Buffer} pcmBuffer - PCM 16-bit little-endian intercalado
 * @param {{ sampleRate?: number, channels?: number, bitDepth?: number }} [opts]
 * @returns {number} bytes escritos
 */
export function writeWavFile(outputPath, pcmBuffer, opts = {}) {
  const sampleRate = opts.sampleRate || 16000;
  const channels = opts.channels || 1;
  const bitDepth = opts.bitDepth || 16;

  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);            // subchunk1 size
  header.writeUInt16LE(1, 20);             // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  fs.writeFileSync(outputPath, Buffer.concat([header, pcmBuffer]));
  return 44 + dataSize;
}

/**
 * Calcula o nível RMS de um buffer PCM 16-bit LE.
 * Útil para detectar silêncio durante a captura contínua.
 *
 * @param {Buffer} pcmBuffer
 * @returns {number} 0..1 (normalizado)
 */
export function rmsLevel(pcmBuffer) {
  if (!pcmBuffer || pcmBuffer.length < 2) return 0;

  const samples = pcmBuffer.length >> 1;
  let sumSq = 0;

  for (let i = 0; i < samples; i++) {
    const v = pcmBuffer.readInt16LE(i * 2) / 32768;
    sumSq += v * v;
  }

  return Math.sqrt(sumSq / samples);
}