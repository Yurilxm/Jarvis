import { BUILTIN_KEYWORDS, isBuiltinKeyword, frameSplitter } from '../src/voice/wakeword.js';
import { writeWavFile, rmsLevel } from '../src/voice/wav.js';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempDir, removeTempDir } from './helpers/temp.js';

describe('wakeword — isBuiltinKeyword', () => {
  it('reconhece JARVIS', () => {
    expect(isBuiltinKeyword('JARVIS')).toBe(true);
    expect(isBuiltinKeyword('jarvis')).toBe(true);
    expect(isBuiltinKeyword('Jarvis')).toBe(true);
  });

  it('reconhece outros builtins', () => {
    expect(isBuiltinKeyword('COMPUTER')).toBe(true);
    expect(isBuiltinKeyword('PICOVOICE')).toBe(true);
  });

  it('rejeita palavra desconhecida', () => {
    expect(isBuiltinKeyword('FOOBAR')).toBe(false);
    expect(isBuiltinKeyword('')).toBe(false);
    expect(isBuiltinKeyword(null)).toBe(false);
  });

  it('BUILTIN_KEYWORDS tem os principais', () => {
    expect(BUILTIN_KEYWORDS).toEqual(expect.arrayContaining(['JARVIS', 'COMPUTER', 'PICOVOICE']));
  });
});

describe('wakeword — frameSplitter', () => {
  it('agrupa bytes em frames exatos', () => {
    const splitter = frameSplitter(4); // 4 amostras por frame = 8 bytes
    const buf = Buffer.alloc(20); // 2.5 frames

    const frames = splitter.push(buf);
    expect(frames.length).toBe(2);
    expect(frames[0].length).toBe(4);
    expect(frames[1].length).toBe(4);
  });

  it('mantém sobra entre pushes', () => {
    const splitter = frameSplitter(4);
    const f1 = splitter.push(Buffer.alloc(10)); // 1 frame + 2 bytes sobra
    const f2 = splitter.push(Buffer.alloc(10)); // completa o frame + 1

    expect(f1.length).toBe(1);
    expect(f2.length).toBe(1);
  });

  it('flush limpa a sobra', () => {
    const splitter = frameSplitter(4);
    splitter.push(Buffer.alloc(6)); // 0 frames, 6 bytes sobra
    splitter.flush();
    // Depois do flush, um novo push com 8 bytes deve produzir exatamente 1 frame
    const f = splitter.push(Buffer.alloc(8));
    expect(f.length).toBe(1);
  });

  it('preserva valores PCM corretamente', () => {
    const splitter = frameSplitter(2);
    const buf = Buffer.alloc(4);
    buf.writeInt16LE(100, 0);
    buf.writeInt16LE(-200, 2);

    const frames = splitter.push(buf);
    expect(frames[0][0]).toBe(100);
    expect(frames[0][1]).toBe(-200);
  });
});

describe('wav — writeWavFile', () => {
  it('gera arquivo com header RIFF/WAVE válido', () => {
    const dir = makeTempDir();
    try {
      const filePath = path.join(dir, 'test.wav');
      const pcm = Buffer.alloc(320); // 160 amostras de 16-bit
      writeWavFile(filePath, pcm, { sampleRate: 16000 });

      const buf = fs.readFileSync(filePath);
      expect(buf.length).toBe(44 + 320);
      expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
      expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
      expect(buf.readUInt32LE(24)).toBe(16000); // sampleRate
      expect(buf.readUInt16LE(22)).toBe(1); // mono
      expect(buf.readUInt16LE(34)).toBe(16); // bitDepth
      expect(buf.readUInt32LE(40)).toBe(320); // dataSize
    } finally {
      removeTempDir(dir);
    }
  });

  it('aceita estéreo', () => {
    const dir = makeTempDir();
    try {
      const filePath = path.join(dir, 'stereo.wav');
      writeWavFile(filePath, Buffer.alloc(100), { channels: 2 });
      const buf = fs.readFileSync(filePath);
      expect(buf.readUInt16LE(22)).toBe(2);
    } finally {
      removeTempDir(dir);
    }
  });
});

describe('wav — rmsLevel', () => {
  it('retorna 0 para buffer vazio', () => {
    expect(rmsLevel(Buffer.alloc(0))).toBe(0);
    expect(rmsLevel(null)).toBe(0);
  });

  it('retorna 0 para silêncio', () => {
    expect(rmsLevel(Buffer.alloc(100))).toBe(0);
  });

  it('retorna valor > 0 para sinal', () => {
    const buf = Buffer.alloc(200);
    for (let i = 0; i < 100; i++) buf.writeInt16LE(16000, i * 2);
    const level = rmsLevel(buf);
    expect(level).toBeGreaterThan(0.4);
  });

  it('sinal mais alto retorna RMS maior', () => {
    const low = Buffer.alloc(100);
    const high = Buffer.alloc(100);
    for (let i = 0; i < 50; i++) {
      low.writeInt16LE(1000, i * 2);
      high.writeInt16LE(30000, i * 2);
    }
    expect(rmsLevel(high)).toBeGreaterThan(rmsLevel(low));
  });
});