import fs from 'node:fs';
import path from 'node:path';
import { validateImageFile, SUPPORTED_EXTENSIONS } from '../src/transcribe/ocr.js';
import { ensureGitignoreEntry } from '../src/utils/gitignore.js';
import { makeTempDir, removeTempDir } from './helpers/temp.js';
import {
  parseOcrOutput,
  computeAverageConfidence,
  computeTextQuality,
  isSuspiciousToken,
  shouldOfferAI,
  PYTHON_CANDIDATES,
} from '../src/transcribe/ocr-local.js';
import { getMimeType } from '../src/transcribe/gemini-vision.js';

describe('transcribe — validateImageFile', () => {
  let cwd;

  beforeEach(() => {
    cwd = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(cwd);
  });

  it('retorna erro quando nenhum caminho é informado', () => {
    const r = validateImageFile();
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Informe o caminho/);
  });

  it('retorna erro quando arquivo não existe', () => {
    const r = validateImageFile(path.join(cwd, 'nao-existe.png'));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/não encontrado/i);
  });

  it('aceita arquivos com extensões suportadas', () => {
    const file = path.join(cwd, 'imagem.png');
    fs.writeFileSync(file, 'x');
    const r = validateImageFile(file);
    expect(r.ok).toBe(true);
  });

  it('rejeita extensões não suportadas', () => {
    const file = path.join(cwd, 'arquivo.txt');
    fs.writeFileSync(file, 'x');
    const r = validateImageFile(file);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/não suportada/i);
  });

  it('rejeita diretórios (mesmo com extensão de imagem)', () => {
    const dir = path.join(cwd, 'subdir.png');
    fs.mkdirSync(dir);
    const r = validateImageFile(dir);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/não é um arquivo/i);
  });

  it('lista de extensões suportadas inclui formatos comuns', () => {
    expect(SUPPORTED_EXTENSIONS).toEqual(expect.arrayContaining(['.png', '.jpg', '.jpeg']));
  });
});

describe('transcribe — parseOcrOutput', () => {
  it('extrai JSON depois do marker', () => {
    const stdout = 'ruido inicial\n__OCR_RESULT__{"text":"oi","confidence":0.9}\n';
    const r = parseOcrOutput(stdout);
    expect(r.text).toBe('oi');
    expect(r.confidence).toBe(0.9);
  });

  it('usa o ÚLTIMO marker quando há vários', () => {
    const stdout = '__OCR_RESULT__{"text":"antigo"}\n__OCR_RESULT__{"text":"novo"}\n';
    const r = parseOcrOutput(stdout);
    expect(r.text).toBe('novo');
  });

  it('lança quando não há marker', () => {
    expect(() => parseOcrOutput('sem marker nenhum')).toThrow(/não contém resultado/);
  });

  it('lança quando o JSON é inválido', () => {
    const stdout = '__OCR_RESULT__{nao-e-json}\n';
    expect(() => parseOcrOutput(stdout)).toThrow(/interpretar resultado/);
  });

  it('lança quando stdout é vazio', () => {
    expect(() => parseOcrOutput('')).toThrow(/vazia/);
  });
});

describe('transcribe — computeAverageConfidence', () => {
  it('média de scores válidos', () => {
    expect(computeAverageConfidence([
      { score: 0.8 }, { score: 0.6 }, { score: 1.0 }
    ])).toBeCloseTo(0.8, 5);
  });

  it('ignora scores inválidos (null, undefined, string, NaN)', () => {
    expect(computeAverageConfidence([
      { score: 0.8 }, { score: 'abc' }, { score: null }, { score: 0.6 }
    ])).toBeCloseTo(0.7, 5);
  });

  it('ignora null explicitamente (não conta como 0)', () => {
    expect(computeAverageConfidence([
      { score: null }, { score: 0.8 }, { score: null }
    ])).toBeCloseTo(0.8, 5);
  });

  it('retorna 0 para array vazio', () => {
    expect(computeAverageConfidence([])).toBe(0);
    expect(computeAverageConfidence(null)).toBe(0);
  });

  it('retorna 0 quando nenhum score é válido', () => {
    expect(computeAverageConfidence([{ score: 'x' }, { score: null }])).toBe(0);
  });
});

describe('transcribe — isSuspiciousToken', () => {
  it('detecta 3+ consoantes seguidas', () => {
    expect(isSuspiciousToken('bbpl')).toBe(true);
    expect(isSuspiciousToken('comrlite')).toBe(true);
    expect(isSuspiciousToken('wsnnuto')).toBe(true);
  });

  it('detecta número misturado com letras', () => {
    expect(isSuspiciousToken('10sfotos')).toBe(true);
    expect(isSuspiciousToken('1ªconsul')).toBe(true);
  });

  it('detecta baixa proporção de vogais em palavra longa', () => {
    expect(isSuspiciousToken('mtrpskk')).toBe(true);
  });

  it('detecta caractere estranho', () => {
    expect(isSuspiciousToken('abc€def')).toBe(true);
    expect(isSuspiciousToken('letra©')).toBe(true);
  });

  it('aceita palavras normais em português', () => {
    expect(isSuspiciousToken('momento')).toBe(false);
    expect(isSuspiciousToken('especiais')).toBe(false);
    expect(isSuspiciousToken('família')).toBe(false);
    expect(isSuspiciousToken('documento')).toBe(false);
    expect(isSuspiciousToken('ordem')).toBe(false);
  });

  it('aceita palavras curtas (1-2 letras)', () => {
    expect(isSuspiciousToken('a')).toBe(false);
    expect(isSuspiciousToken('de')).toBe(false);
    expect(isSuspiciousToken('oi')).toBe(false);
    expect(isSuspiciousToken('eu')).toBe(false);
    expect(isSuspiciousToken('pa')).toBe(false);
  });

  it('aceita números puros', () => {
    expect(isSuspiciousToken('123')).toBe(false);
    expect(isSuspiciousToken('2026')).toBe(false);
  });

  it('detecta consoantes duplas raras em PT', () => {
    expect(isSuspiciousToken('pommro')).toBe(true);
    expect(isSuspiciousToken('Suonnsa')).toBe(true);
    expect(isSuspiciousToken('bocca')).toBe(true); // "cc" é raro em PT
  });

  it('detecta vogais duplas raras em PT (ii, uu)', () => {
    expect(isSuspiciousToken('liidas')).toBe(true);
    expect(isSuspiciousToken('xuul')).toBe(true);
  });

  it('aceita consoantes duplas comuns em PT (rr, ss, lh, nh)', () => {
    expect(isSuspiciousToken('carro')).toBe(false);
    expect(isSuspiciousToken('passo')).toBe(false);
    expect(isSuspiciousToken('filho')).toBe(false);
    expect(isSuspiciousToken('banho')).toBe(false);
  });

  it('detecta palavra sem nenhuma vogal', () => {
    expect(isSuspiciousToken('mtrpskk')).toBe(true);
    expect(isSuspiciousToken('bcdfg')).toBe(true);
  });
});

describe('transcribe — computeTextQuality', () => {
  it('texto bom tem qualidade alta (score baixo)', () => {
    const q = computeTextQuality('Olá, mundo! Este é um texto normal em português.');
    expect(q).toBeLessThan(0.25);
  });

  it('texto ruim tem qualidade baixa (score alto)', () => {
    const q = computeTextQuality('bbpl regurran o wsnnuto mtrpskk 10sfotos');
    expect(q).toBeGreaterThan(0.5);
  });

  it('retorna 0 para texto vazio', () => {
    expect(computeTextQuality('')).toBe(0);
    expect(computeTextQuality(null)).toBe(0);
    expect(computeTextQuality(undefined)).toBe(0);
  });
});

describe('transcribe — shouldOfferAI', () => {
  it('true quando confiança < 0.9', () => {
    expect(shouldOfferAI(0.5, 0)).toBe(true);
    expect(shouldOfferAI(0.85, 0)).toBe(true);
    expect(shouldOfferAI(0.89, 0)).toBe(true);
  });

  it('true quando qualidade > 0.15', () => {
    expect(shouldOfferAI(0.95, 0.2)).toBe(true);
    expect(shouldOfferAI(0.95, 0.8)).toBe(true);
  });

  it('false quando confiança >= 0.9 E qualidade <= 0.15', () => {
    expect(shouldOfferAI(0.9, 0.1)).toBe(false);
    expect(shouldOfferAI(0.95, 0.05)).toBe(false);
    expect(shouldOfferAI(1.0, 0)).toBe(false);
  });

  it('trata valores inválidos', () => {
    expect(shouldOfferAI(null, null)).toBe(true);
    expect(shouldOfferAI(undefined, undefined)).toBe(true);
  });
});

describe('transcribe — PYTHON_CANDIDATES', () => {
  it('tem python e py -3.12 como candidatos', () => {
    const labels = PYTHON_CANDIDATES.map((c) => c.label);
    expect(labels).toContain('python');
    expect(labels).toContain('py -3.12');
  });

  it('todos os candidatos têm cmd e args', () => {
    for (const c of PYTHON_CANDIDATES) {
      expect(typeof c.cmd).toBe('string');
      expect(Array.isArray(c.args)).toBe(true);
      expect(typeof c.label).toBe('string');
    }
  });
});

describe('transcribe — getMimeType', () => {
  it('mapeia extensões comuns', () => {
    expect(getMimeType('a.png')).toBe('image/png');
    expect(getMimeType('b.jpg')).toBe('image/jpeg');
    expect(getMimeType('c.jpeg')).toBe('image/jpeg');
    expect(getMimeType('d.webp')).toBe('image/webp');
  });

  it('case-insensitive', () => {
    expect(getMimeType('A.PNG')).toBe('image/png');
    expect(getMimeType('B.JPG')).toBe('image/jpeg');
  });

  it('retorna null para extensão desconhecida', () => {
    expect(getMimeType('a.txt')).toBeNull();
    expect(getMimeType('')).toBeNull();
    expect(getMimeType(null)).toBeNull();
  });
});

describe('gitignore — ensureGitignoreEntry', () => {
  it('cria .gitignore quando não existe', () => {
    const cwd = makeTempDir();
    try {
      const r = ensureGitignoreEntry('transcricoes/', cwd);
      expect(r.created).toBe(true);
      expect(r.added).toBe(true);
      const content = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf-8');
      expect(content).toContain('transcricoes/');
    } finally {
      removeTempDir(cwd);
    }
  });

  it('adiciona entrada quando .gitignore existe sem ela', () => {
    const cwd = makeTempDir();
    try {
      fs.writeFileSync(path.join(cwd, '.gitignore'), 'node_modules/\n');
      const r = ensureGitignoreEntry('transcricoes/', cwd);
      expect(r.added).toBe(true);
      const content = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf-8');
      expect(content).toContain('transcricoes/');
      expect(content).toContain('node_modules/');
    } finally {
      removeTempDir(cwd);
    }
  });

  it('não duplica quando a entrada já existe', () => {
    const cwd = makeTempDir();
    try {
      fs.writeFileSync(path.join(cwd, '.gitignore'), 'transcricoes/\n');
      const r = ensureGitignoreEntry('transcricoes/', cwd);
      expect(r.added).toBe(false);
    } finally {
      removeTempDir(cwd);
    }
  });
});