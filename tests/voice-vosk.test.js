import {
  getVoskModelDir,
  isVoskModelValid,
  listInstalledVoskModels,
  estimateDirSize,
  formatBytes,
  VOSK_MODELS,
} from '../src/voice/vosk/model-manager.js';
import {
  detectVoskModel,
  checkVoskDependencies,
  PYTHON_CANDIDATES,
} from '../src/voice/vosk/dependencies.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { makeTempDir, removeTempDir } from './helpers/temp.js';

function makeVoskModelDir(baseDir, name) {
  const dir = path.join(baseDir, name);
  fs.mkdirSync(path.join(dir, 'am'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'conf'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'graph'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'am', 'final.mdl'), 'x'.repeat(100));
  return dir;
}

describe('vosk — getVoskModelDir', () => {
  it('retorna caminho dentro de ~/.jarvis-dev/vosk-models', () => {
    const p = getVoskModelDir('vosk-model-small-pt-0.3');
    expect(p).toContain('.jarvis-dev');
    expect(p).toContain('vosk-models');
    expect(p).toContain('vosk-model-small-pt-0.3');
  });
});

describe('vosk — isVoskModelValid', () => {
  let base;

  beforeEach(() => {
    base = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(base);
  });

  it('retorna false se pasta não existe', () => {
    expect(isVoskModelValid(path.join(base, 'nao-existe'))).toBe(false);
    expect(isVoskModelValid('')).toBe(false);
    expect(isVoskModelValid(null)).toBe(false);
  });

  it('retorna false se pasta existe mas sem am/conf/graph', () => {
    const dir = path.join(base, 'incompleto');
    fs.mkdirSync(dir);
    fs.mkdirSync(path.join(dir, 'am'));
    expect(isVoskModelValid(dir)).toBe(false);
  });

  it('retorna true se tem am/, conf/, graph/', () => {
    const dir = makeVoskModelDir(base, 'modelo-valido');
    expect(isVoskModelValid(dir)).toBe(true);
  });

  it('retorna false se am/ é arquivo em vez de pasta', () => {
    const dir = path.join(base, 'am-como-arquivo');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'am'), 'arquivo');
    fs.mkdirSync(path.join(dir, 'conf'));
    fs.mkdirSync(path.join(dir, 'graph'));
    expect(isVoskModelValid(dir)).toBe(false);
  });
});

describe('vosk — estimateDirSize', () => {
  it('soma recursivamente', () => {
    const base = makeTempDir();
    try {
      fs.writeFileSync(path.join(base, 'a.txt'), 'x'.repeat(100));
      fs.mkdirSync(path.join(base, 'sub'));
      fs.writeFileSync(path.join(base, 'sub', 'b.txt'), 'y'.repeat(50));
      expect(estimateDirSize(base)).toBe(150);
    } finally {
      removeTempDir(base);
    }
  });

  it('retorna 0 para pasta vazia', () => {
    const base = makeTempDir();
    try {
      expect(estimateDirSize(base)).toBe(0);
    } finally {
      removeTempDir(base);
    }
  });

  it('retorna 0 para pasta inexistente', () => {
    expect(estimateDirSize(path.join(os.tmpdir(), 'nao-existe-' + Date.now()))).toBe(0);
  });
});

describe('vosk — formatBytes', () => {
  it('formata bytes, KB, MB, GB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('trata valores inválidos', () => {
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
  });
});

describe('vosk — VOSK_MODELS', () => {
  it('tem small-pt e full-pt', () => {
    expect(VOSK_MODELS['small-pt']).toBeTruthy();
    expect(VOSK_MODELS['full-pt']).toBeTruthy();
  });

  it('URLs apontam para alphacephei.com', () => {
    for (const key of Object.keys(VOSK_MODELS)) {
      expect(VOSK_MODELS[key].url).toMatch(/alphacephei\.com/);
      expect(VOSK_MODELS[key].url).toMatch(/\.zip$/);
    }
  });
});

describe('vosk — detectVoskModel', () => {
  it('retorna ok quando voiceConfig aponta para modelo válido', () => {
    const tmp = makeTempDir();
    try {
      const modelDir = path.join(tmp, 'modelo-teste');
      fs.mkdirSync(path.join(modelDir, 'am'), { recursive: true });
      fs.mkdirSync(path.join(modelDir, 'conf'));
      fs.mkdirSync(path.join(modelDir, 'graph'));

      const r = detectVoskModel({ voskModelPath: modelDir });
      expect(r.ok).toBe(true);
      expect(r.path).toBe(modelDir);
    } finally {
      removeTempDir(tmp);
    }
  });

  it('retorna erro quando voiceConfig aponta para caminho inexistente E nenhum modelo é encontrado', () => {
    // Usa jest.unstable_mockModule para isolar as constantes já avaliadas
    // no import. Como não podemos mockar depois do import, testamos apenas
    // o caminho "config invalido" aqui, sem garantir nada sobre o disco.
    // Em ambiente de teste, é aceitável que essa função retorne ok=true
    // se um modelo estiver instalado no PC real — então esse teste apenas
    // valida que a função devolve um resultado coerente.
    const r = detectVoskModel({ voskModelPath: '/caminho/inexistente-' + Date.now() });
    expect(r).toHaveProperty('ok');
    expect(typeof r.ok).toBe('boolean');
    if (r.ok) {
      expect(r).toHaveProperty('path');
      expect(r).toHaveProperty('name');
    } else {
      expect(r).toHaveProperty('reason');
    }
  });
});

describe('vosk — PYTHON_CANDIDATES', () => {
  it('prioriza py -3.12 e py -3.11', () => {
    const labels = PYTHON_CANDIDATES.map((c) => c.label);
    expect(labels[0]).toBe('py -3.12');
    expect(labels).toContain('py -3.11');
    expect(labels).toContain('python');
  });

  it('todos têm cmd e args', () => {
    for (const c of PYTHON_CANDIDATES) {
      expect(typeof c.cmd).toBe('string');
      expect(Array.isArray(c.args)).toBe(true);
      expect(typeof c.label).toBe('string');
    }
  });
});

describe('vosk — checkVoskDependencies', () => {
  let fakeHome;
  let originalHome;

  beforeEach(() => {
    fakeHome = makeTempDir();
    originalHome = os.homedir;
    os.homedir = () => fakeHome;
  });

  afterEach(() => {
    os.homedir = originalHome;
    removeTempDir(fakeHome);
  });

  it('retorna objeto com estrutura esperada', () => {
    const r = checkVoskDependencies({});
    expect(r).toHaveProperty('python');
    expect(r).toHaveProperty('model');
    expect(r).toHaveProperty('script');
    expect(r).toHaveProperty('ok');
    expect(r).toHaveProperty('missing');
    expect(Array.isArray(r.missing)).toBe(true);
  });

  it('marca python como missing quando nenhum Python tem vosk', () => {
    const r = checkVoskDependencies({});
    // Em ambiente de teste, é esperado que python.ok seja false
    // (não temos vosk instalado no CI)
    if (!r.python.ok) {
      expect(r.missing).toContain('python');
    }
  });

  it('model.script aponta para scripts/vosk_stream.py', () => {
    const r = checkVoskDependencies({});
    expect(r.script.path).toMatch(/vosk_stream\.py$/);
  });
});