import { pickWhisperAsset, MODELS, ensureDir } from '../src/voice/setup.js';
import fs from 'node:fs';
import { makeTempDir, removeTempDir } from './helpers/temp.js';

describe('voice setup — pickWhisperAsset', () => {
  const assets = [
    { name: 'whisper-bin-x64.zip', browser_download_url: 'https://x/win-x64.zip' },
    { name: 'whisper-bin-arm64.zip', browser_download_url: 'https://x/win-arm64.zip' },
    { name: 'whisper-blas-bin-x64.zip', browser_download_url: 'https://x/win-blas.zip' },
    { name: 'Source code (zip)', browser_download_url: 'https://x/src.zip' },
  ];

  it('Windows x64 escolhe whisper-bin-x64.zip', () => {
    const a = pickWhisperAsset(assets, { platform: 'win32', arch: 'x64' });
    expect(a.name).toBe('whisper-bin-x64.zip');
  });

  it('Windows arm64 escolhe whisper-bin-arm64.zip', () => {
    const a = pickWhisperAsset(assets, { platform: 'win32', arch: 'arm64' });
    expect(a.name).toBe('whisper-bin-arm64.zip');
  });

  it('macOS cai no fallback whisper-bin*.zip', () => {
    const a = pickWhisperAsset(assets, { platform: 'darwin', arch: 'arm64' });
    expect(a).not.toBeNull();
    expect(a.name).toMatch(/^whisper-bin/);
  });

  it('Linux retorna null (precisa compilar)', () => {
    const a = pickWhisperAsset(assets, { platform: 'linux', arch: 'x64' });
    expect(a).toBeNull();
  });

  it('retorna null quando não há assets compatíveis', () => {
    const a = pickWhisperAsset([{ name: 'Source code.zip' }], { platform: 'win32', arch: 'x64' });
    expect(a).toBeNull();
  });
});

describe('voice setup — MODELS', () => {
  it('contém pelo menos tiny, base e small', () => {
    expect(MODELS.tiny).toBeTruthy();
    expect(MODELS.base).toBeTruthy();
    expect(MODELS.small).toBeTruthy();
  });

  it('URLs apontam para huggingface do whisper.cpp', () => {
    for (const key of Object.keys(MODELS)) {
      expect(MODELS[key].url).toMatch(/huggingface\.co\/ggerganov\/whisper\.cpp/);
      expect(MODELS[key].file).toMatch(/^ggml-.*\.bin$/);
    }
  });
});

describe('voice setup — ensureDir', () => {
  it('cria pasta quando não existe', () => {
    const base = makeTempDir();
    try {
      const target = `${base}/sub/nested`;
      ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    } finally {
      removeTempDir(base);
    }
  });

  it('não quebra quando pasta já existe', () => {
    const base = makeTempDir();
    try {
      ensureDir(base);
      ensureDir(base);
      expect(fs.existsSync(base)).toBe(true);
    } finally {
      removeTempDir(base);
    }
  });
});