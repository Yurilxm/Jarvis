import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  VOSK_MODELS_DIR,
  VOSK_MODELS,
  getVoskModelDir,
  isVoskModelValid,
  listInstalledVoskModels,
} from './model-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const VOSK_SCRIPT_PATH = path.resolve(
  __dirname, '..', '..', '..', 'scripts', 'vosk_stream.py'
);

/**
 * Candidatos de Python, em ordem de preferência.
 * Vosk é mais estável em Python 3.12 ou anterior.
 */
export const PYTHON_CANDIDATES = [
  { cmd: 'py', args: ['-3.12'], label: 'py -3.12' },
  { cmd: 'py', args: ['-3.11'], label: 'py -3.11' },
  { cmd: 'py', args: ['-3.10'], label: 'py -3.10' },
  { cmd: 'python', args: [], label: 'python' },
  { cmd: 'py', args: [], label: 'py' },
  { cmd: 'python3', args: [], label: 'python3' },
];

/**
 * Testa se um Python responde `--version`.
 */
function testPython(candidate) {
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

/**
 * Testa se um Python tem o pacote `vosk` instalado.
 */
function testVoskPackage(candidate) {
  try {
    const res = spawnSync(
      candidate.cmd,
      [...candidate.args, '-c', 'import vosk; print(vosk.__version__ if hasattr(vosk, "__version__") else "ok")'],
      { encoding: 'utf-8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Encontra um Python utilizável que tenha o pacote `vosk`.
 *
 * @returns {{
 *   ok: boolean,
 *   python?: { cmd: string, args: string[], label: string },
 *   reason?: string,
 * }}
 */
export function detectVoskPython() {
  let foundPythonWithoutVosk = null;

  for (const candidate of PYTHON_CANDIDATES) {
    if (!testPython(candidate)) continue;
    if (foundPythonWithoutVosk === null) {
      foundPythonWithoutVosk = candidate;
    }
    if (testVoskPackage(candidate)) {
      return { ok: true, python: candidate };
    }
  }

  if (foundPythonWithoutVosk) {
    return {
      ok: false,
      reason:
        `Python encontrado (${foundPythonWithoutVosk.label}), mas o pacote "vosk" não está instalado.\n` +
        `  Instale com: ${foundPythonWithoutVosk.cmd} ${foundPythonWithoutVosk.args.join(' ')} -m pip install vosk`,
    };
  }

  return {
    ok: false,
    reason:
      'Nenhum Python utilizável encontrado.\n' +
      '  Instale Python 3.10+ em https://www.python.org/downloads/',
  };
}

/**
 * Detecta o modelo Vosk a usar.
 * Prioridade: config > small-pt instalado > primeiro modelo válido encontrado.
 *
 * @param {object} [voiceConfig] - config carregada (opcional)
 * @returns {{ ok: boolean, path?: string, name?: string, reason?: string }}
 */
export function detectVoskModel(voiceConfig = {}) {
  // 1. Config explícita
  const cfgPath = voiceConfig.voskModelPath;
  if (cfgPath && fs.existsSync(cfgPath) && isVoskModelValid(cfgPath)) {
    return { ok: true, path: cfgPath, name: path.basename(cfgPath) };
  }

  // 2. Caminho preferido (small-pt)
  const preferred = getVoskModelDir(VOSK_MODELS['small-pt'].name);
  if (isVoskModelValid(preferred)) {
    return { ok: true, path: preferred, name: VOSK_MODELS['small-pt'].name };
  }

  // 3. Qualquer modelo válido instalado
  const installed = listInstalledVoskModels();
  if (installed.length > 0) {
    return { ok: true, path: installed[0].path, name: installed[0].name };
  }

  return {
    ok: false,
    reason:
      'Modelo Vosk não encontrado.\n' +
      `  Rode: jarvis voz --setup --engine vosk\n` +
      `  Ou baixe manualmente em https://alphacephei.com/vosk/models/\n` +
      `  E extraia em: ${VOSK_MODELS_DIR}`,
  };
}

/**
 * Checagem agregada de tudo que o Vosk precisa.
 *
 * @param {object} [voiceConfig]
 * @returns {{
 *   python: object,
 *   model: object,
 *   script: { ok: boolean, path: string },
 *   ok: boolean,
 *   missing: string[],
 * }}
 */
export function checkVoskDependencies(voiceConfig = {}) {
  const python = detectVoskPython();
  const model = detectVoskModel(voiceConfig);
  const scriptExists = fs.existsSync(VOSK_SCRIPT_PATH);

  const missing = [];
  if (!python.ok) missing.push('python');
  if (!model.ok) missing.push('model');
  if (!scriptExists) missing.push('script');

  return {
    python,
    model,
    script: { ok: scriptExists, path: VOSK_SCRIPT_PATH },
    ok: missing.length === 0,
    missing,
  };
}

export { VOSK_MODELS_DIR, VOSK_MODELS, getVoskModelDir, isVoskModelValid };