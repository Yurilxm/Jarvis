import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'ocr_local.py');

const CONFIG_DIR = path.join(os.homedir(), '.jarvis-dev');
const CONFIG_PATH = path.join(CONFIG_DIR, 'ocr.json');

const RESULT_MARKER = '__OCR_RESULT__';

export const PYTHON_CANDIDATES = [
  { cmd: 'python', args: [], label: 'python' },
  { cmd: 'py', args: ['-3.12'], label: 'py -3.12' },
  { cmd: 'py', args: ['-3.11'], label: 'py -3.11' },
  { cmd: 'py', args: ['-3.10'], label: 'py -3.10' },
  { cmd: 'py', args: [], label: 'py' },
  { cmd: 'python3', args: [], label: 'python3' },
];

export const CONFIDENCE_THRESHOLD = 0.9;
export const QUALITY_THRESHOLD = 0.15;

// Consoantes duplas raras em PT — se aparecem, é sinal de leitura ruim.
// (rr, ss, lh, nh, ch, qu são comuns; bb, cc, dd, ff, gg, jj, kk, mm, pp, tt, vv, ww, zz não)
const RARE_DOUBLE_CONSONANTS = /(bb|cc|dd|ff|gg|hh|jj|kk|mm|pp|qq|tt|vv|ww|xx|zz)/i;

function readCachedPython() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (!data.pythonCmd) return null;
    return {
      cmd: data.pythonCmd,
      args: Array.isArray(data.pythonArgs) ? data.pythonArgs : [],
      label: data.pythonLabel || data.pythonCmd,
    };
  } catch {
    return null;
  }
}

function saveCachedPython(candidate) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify(
        {
          pythonCmd: candidate.cmd,
          pythonArgs: candidate.args,
          pythonLabel: candidate.label,
          detectedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch {
    // silencioso
  }
}

function testPythonCandidate(candidate) {
  try {
    const res = spawnSync(
      candidate.cmd,
      [...candidate.args, '--version'],
      { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return res.status === 0;
  } catch {
    return false;
  }
}

export function detectPython(opts = {}) {
  if (!opts.forceRedetect) {
    const cached = readCachedPython();
    if (cached && testPythonCandidate(cached)) return cached;
  }

  for (const candidate of PYTHON_CANDIDATES) {
    if (testPythonCandidate(candidate)) {
      saveCachedPython(candidate);
      return candidate;
    }
  }
  return null;
}

export function getOcrScriptPath() {
  return SCRIPT_PATH;
}

export function parseOcrOutput(stdout) {
  if (!stdout) {
    throw new Error('Saída do OCR vazia.');
  }
  const idx = stdout.lastIndexOf(RESULT_MARKER);
  if (idx === -1) {
    throw new Error('Saída do OCR não contém resultado esperado.');
  }
  const after = stdout.substring(idx + RESULT_MARKER.length);
  const jsonLine = after.split('\n')[0].trim();
  if (!jsonLine) {
    throw new Error('Resultado do OCR está vazio.');
  }
  try {
    return JSON.parse(jsonLine);
  } catch (err) {
    throw new Error(`Falha ao interpretar resultado do OCR: ${err.message}`);
  }
}

/**
 * Média de score das linhas, ignorando valores não-numéricos.
 * @param {Array<{ score: number }>} lines
 * @returns {number} 0..1
 */
export function computeAverageConfidence(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const line of lines) {
    const s = line?.score;
    if (typeof s === 'number' && Number.isFinite(s)) {
      sum += s;
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * Um token parece "lixo"?
 *
 * Regras (qualquer uma → suspeito):
 *  1. 3+ consoantes seguidas ("bbpl", "comrlite", "wsnnuto")
 *  2. Consoante dupla rara em PT ("mm", "nn", "tt", "bb", "cc", etc.)
 *  3. Vogal dupla rara em PT ("ii", "uu")
 *  4. Caractere fora do alfabeto latino / pontuação comum
 *  5. Número misturado com 3+ letras ("10sfotos", "1ªconsul")
 *  6. Palavra >= 5 letras com < 25% de vogais
 *  7. Palavra >= 5 letras sem nenhuma vogal
 *
 * IMPORTANTE: tokens de 1-2 letras são sempre aceitos (não dá pra julgar).
 *
 * @param {string} token
 * @returns {boolean}
 */
export function isSuspiciousToken(token) {
  if (!token || typeof token !== 'string') return false;
  const t = token.trim();

  // 1-2 caracteres: aceita qualquer coisa
  if (t.length < 3) return false;

  const lower = t.toLowerCase();

  // 1. 3+ consoantes seguidas
  if (/[bcdfghjklmnpqrstvwxyzç]{3,}/i.test(lower)) return true;

  // 2. Consoante dupla rara em PT
  if (RARE_DOUBLE_CONSONANTS.test(lower)) return true;

  // 3. Vogal dupla rara em PT ("ii", "uu")
  if (/(ii|uu)/i.test(lower)) return true;

  // 4. Caractere fora do PT
  if (/[^\p{L}\p{N}\-'.,;:!?()"“”]/u.test(lower)) return true;

  // 5. Número misturado com 3+ letras
  if (/\d/.test(lower) && /\p{L}/u.test(lower)) {
    const letterCount = (lower.match(/\p{L}/gu) || []).length;
    if (letterCount >= 3) return true;
  }

  // 6/7. Baixa proporção de vogais
  const letters = lower.match(/\p{L}/gu) || [];
  if (letters.length >= 5) {
    const vowels = (lower.match(/[aeiouáéíóúâêôãõàèìòùäëïöü]/gi) || []).length;
    if (vowels === 0) return true;
    if (vowels / letters.length < 0.25) return true;
  }

  return false;
}

/**
 * Qualidade do texto: proporção de tokens suspeitos.
 * @param {string} text
 * @returns {number} 0..1
 */
export function computeTextQuality(text) {
  if (!text || typeof text !== 'string') return 0;
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;

  let suspicious = 0;
  for (const token of tokens) {
    if (!/\p{L}|\p{N}/u.test(token)) continue;
    if (isSuspiciousToken(token)) suspicious++;
  }

  const useful = tokens.filter((t) => /\p{L}|\p{N}/u.test(t)).length;
  return useful === 0 ? 0 : suspicious / useful;
}

/**
 * Decide se vale oferecer IA.
 * @param {number} confidence
 * @param {number} quality
 * @returns {boolean}
 */
export function shouldOfferAI(confidence, quality) {
  const conf = (typeof confidence === 'number' && Number.isFinite(confidence))
    ? confidence
    : 0;
  const qual = (typeof quality === 'number' && Number.isFinite(quality))
    ? quality
    : 0;

  return conf < CONFIDENCE_THRESHOLD || qual > QUALITY_THRESHOLD;
}

export function runLocalOcr(imagePath) {
  const absolute = path.resolve(imagePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Arquivo não encontrado: ${absolute}`);
  }

  if (!fs.existsSync(SCRIPT_PATH)) {
    throw new Error(
      `Script de OCR não encontrado em: ${SCRIPT_PATH}\n` +
      '  Ele deveria estar em scripts/ocr_local.py do repositório do Jarvis.'
    );
  }

  const python = detectPython();
  if (!python) {
    throw new Error(
      'Nenhum Python utilizável encontrado.\n' +
      '  Instale Python 3.10+ e depois:\n' +
      '    pip install rapidocr onnxruntime'
    );
  }

  const res = spawnSync(
    python.cmd,
    [...python.args, SCRIPT_PATH, absolute],
    {
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  if (res.status !== 0) {
    const stderr = (res.stderr || '').trim();
    if (stderr.includes('RapidOCR nao instalado')) {
      throw new Error(
        'RapidOCR não está instalado no Python detectado.\n' +
        `  Python: ${python.label}\n` +
        '  Instale com: pip install rapidocr onnxruntime'
      );
    }
    const lastLines = stderr.split('\n').slice(-3).join('\n').trim();
    throw new Error(
      `Falha ao executar OCR${lastLines ? `:\n${lastLines}` : '.'}`
    );
  }

  const parsed = parseOcrOutput(res.stdout || '');
  const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
  const text = typeof parsed.text === 'string' ? parsed.text : '';
  const confidence = typeof parsed.confidence === 'number' && parsed.confidence > 0
    ? parsed.confidence
    : computeAverageConfidence(lines);
  const quality = computeTextQuality(text);

  return {
    text,
    lines,
    confidence,
    quality,
    elapsed: parsed.elapsed || 0,
    engine: 'rapidocr',
    python: python.label,
  };
}