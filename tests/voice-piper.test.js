import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock do fs ANTES de importar o modulo testado
jest.unstable_mockModule('node:fs', () => ({
  default: {
    existsSync: jest.fn(),
    readdirSync: jest.fn(),
  },
}));

jest.unstable_mockModule('node:child_process', () => ({
  spawnSync: jest.fn(),
}));

const fs = (await import('node:fs')).default;
const { spawnSync } = await import('node:child_process');

const {
  checkPiperDependencies,
  detectPiperModel,
  listPiperModels,
  PIPER_MODELS_DIR,
} = await import('../src/voice/piper/dependencies.js');

describe('piper/dependencies — detectPiperModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna ok quando config aponta para .onnx + .onnx.json existentes', () => {
    fs.existsSync.mockImplementation((p) => {
      return p === 'C:/models/voz.onnx' || p === 'C:/models/voz.onnx.json';
    });
    const r = detectPiperModel({ piperModelPath: 'C:/models/voz.onnx' });
    expect(r.ok).toBe(true);
    expect(r.path).toBe('C:/models/voz.onnx');
  });

  it('retorna erro quando .onnx existe mas .onnx.json nao', () => {
    fs.existsSync.mockImplementation((p) => p === 'C:/models/voz.onnx');
    const r = detectPiperModel({ piperModelPath: 'C:/models/voz.onnx' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/onnx\.json/);
  });

  it('cai para a pasta padrao quando config esta vazia', () => {
    fs.existsSync.mockImplementation((p) => {
      if (p === PIPER_MODELS_DIR) return true;
      return false;
    });
    fs.readdirSync.mockReturnValue(['pt_BR-faber-medium.onnx', 'pt_BR-faber-medium.onnx.json']);
    // existsSync precisa responder true para o .onnx e o .json
    fs.existsSync.mockImplementation((p) => {
      if (p === PIPER_MODELS_DIR) return true;
      if (typeof p === 'string' && p.endsWith('.onnx.json')) return true;
      return false;
    });

    const r = detectPiperModel({});
    expect(r.ok).toBe(true);
    expect(r.name).toBe('pt_BR-faber-medium');
  });

  it('retorna erro quando nada foi encontrado', () => {
    fs.existsSync.mockReturnValue(false);
    const r = detectPiperModel({});
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/jarvis voz --setup/);
  });
});

describe('piper/dependencies — listPiperModels', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna [] para diretorio inexistente', () => {
    fs.existsSync.mockReturnValue(false);
    expect(listPiperModels('/nao/existe')).toEqual([]);
  });

  it('so lista .onnx que tenha .onnx.json ao lado', () => {
    fs.readdirSync.mockReturnValue(['a.onnx', 'a.onnx.json', 'b.onnx', 'c.txt']);
    // O diretorio existe, e APENAS o .onnx.json do "a" existe.
    fs.existsSync.mockImplementation(
      (p) => p === '/algum' || String(p).endsWith('a.onnx.json')
    );
    const r = listPiperModels('/algum');
    expect(r.map((m) => m.name)).toEqual(['a']);
  });
});

describe('piper/dependencies — checkPiperDependencies', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna ok:false e lista o que falta quando nao ha python', () => {
    spawnSync.mockReturnValue({ status: 1 });
    fs.existsSync.mockReturnValue(false);

    const r = checkPiperDependencies({});
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('python');
    expect(r.missing).toContain('model');
  });

  it('retorna ok:true quando python + pacote + modelo existem', () => {
    spawnSync.mockReturnValue({ status: 0 });
    fs.existsSync.mockImplementation((p) => {
      // .onnx e .onnx.json do config
      if (p === 'C:/m/voz.onnx' || p === 'C:/m/voz.onnx.json') return true;
      return false;
    });

    const r = checkPiperDependencies({ piperModelPath: 'C:/m/voz.onnx' });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });
});
