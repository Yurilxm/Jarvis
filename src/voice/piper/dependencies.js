import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

/**
 * Diretório padrão onde os modelos do Piper ficam.
 */
export const PIPER_MODELS_DIR = path.join(os.homedir(), '.jarvis-dev', 'piper-models');

/**
 * Candidatos de Python, em ordem de preferência. Mesma lógica usada no
 * módulo do Vosk — reaproveita o mesmo interpretador.
 */
export const PIPER_PYTHON_CANDIDATES = [
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
 * Testa se um Python tem o pacote `piper` (piper-tts) instalado.
 */
function testPiperPackage(candidate) {
  try {
    const res = spawnSync(
      candidate.cmd,
      [...candidate.args, '-c', 'import piper; print("ok")'],
      { encoding: 'utf-8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Encontra um Python utilizável que tenha o pacote `piper-tts`.
 *
 * @returns {{
 *   ok: boolean,
 *   python?: { cmd: string, args: string[], label: string },
 *   reason?: string,
 * }}
 */
export function detectPiperPython() {
  let foundPythonWithoutPiper = null;

  for (const candidate of PIPER_PYTHON_CANDIDATES) {
    if (!testPython(candidate)) continue;
    if (foundPythonWithoutPiper === null) {
      foundPythonWithoutPiper = candidate;
    }
    if (testPiperPackage(candidate)) {
      return { ok: true, python: candidate };
    }
  }

  if (foundPythonWithoutPiper) {
    return {
      ok: false,
      reason:
        `Python encontrado (${foundPythonWithoutPiper.label}), mas o pacote "piper-tts" nao esta instalado.\n` +
        `  Instale com: ${foundPythonWithoutPiper.cmd} ${foundPythonWithoutPiper.args.join(' ')} -m pip install piper-tts`,
    };
  }

  return {
    ok: false,
    reason:
      'Nenhum Python utilizavel encontrado.\n' +
      '  Instale Python 3.10+ em https://www.python.org/downloads/',
  };
}

/**
 * Lista modelos .onnx disponíveis em um diretório (com .onnx.json irmão).
 *
 * @param {string} dir
 * @returns {Array<{ path: string, name: string }>}
 */
export function listPiperModels(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.onnx'))
      .map((f) => {
        const onnxPath = path.join(dir, f);
        const jsonPath = onnxPath + '.json';
        return { path: onnxPath, name: f.replace(/\.onnx$/i, ''), jsonExists: fs.existsSync(jsonPath) };
      })
      .filter((m) => m.jsonExists)
      .map(({ path: p, name }) => ({ path: p, name }));
  } catch {
    return [];
  }
}

/**
 * Detecta o modelo do Piper a usar.
 * Prioridade: config > primeiro .onnx válido em ~/.jarvis-dev/piper-models.
 *
 * @param {object} [voiceConfig]
 * @returns {{ ok: boolean, path?: string, name?: string, reason?: string }}
 */
export function detectPiperModel(voiceConfig = {}) {
  // 1. Config explícita
  const cfgPath = voiceConfig.piperModelPath;
  if (cfgPath && fs.existsSync(cfgPath)) {
    const jsonPath = cfgPath + '.json';
    if (fs.existsSync(jsonPath)) {
      return { ok: true, path: cfgPath, name: path.basename(cfgPath, '.onnx') };
    }
    return {
      ok: false,
      reason:
        `Modelo do Piper encontrado em ${cfgPath}, mas falta o arquivo .onnx.json ao lado.\n` +
        '  Os dois arquivos (.onnx e .onnx.json) precisam estar juntos.',
    };
  }

  // 2. Qualquer modelo válido na pasta padrão
  const installed = listPiperModels(PIPER_MODELS_DIR);
  if (installed.length > 0) {
    return { ok: true, path: installed[0].path, name: installed[0].name };
  }

  return {
    ok: false,
    reason:
      'Modelo do Piper nao encontrado.\n' +
      '  Rode: jarvis voz --setup --engine piper\n' +
      '  Ou baixe manualmente:\n' +
      `    py -3.12 -m piper.download_voices pt_BR-faber-medium --data-dir "${PIPER_MODELS_DIR}"`,
  };
}

/**
 * Checagem agregada das dependências do Piper.
 *
 * @param {object} [voiceConfig]
 * @returns {{
 *   python: object,
 *   model: object,
 *   ok: boolean,
 *   missing: string[],
 * }}
 */
export function checkPiperDependencies(voiceConfig = {}) {
  const python = detectPiperPython();
  const model = detectPiperModel(voiceConfig);

  const missing = [];
  if (!python.ok) missing.push('python');
  if (!model.ok) missing.push('model');

  return {
    python,
    model,
    ok: missing.length === 0,
    missing,
  };
}
