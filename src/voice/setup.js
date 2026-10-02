import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { updateVoiceConfig, readVoiceConfig } from './config.js';
import {
  detectRecorder,
  detectWhisper,
  detectWhisperModel,
} from './dependencies.js';
import {
  checkVoskDependencies,
} from './vosk/dependencies.js';
import {
  checkPiperDependencies,
  PIPER_MODELS_DIR,
} from './piper/dependencies.js';
import {
  VOSK_MODELS,
  downloadVoskModel,
  formatBytes,
  getVoskModelDir,
  listInstalledVoskModels,
  estimateDirSize,
} from './vosk/model-manager.js';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  section,
  spinner,
  chalk,
  muted,
} from '../ui.js';
import {
  installStartup,
  removeStartup,
  isStartupInstalled,
  getStartupPath,
} from './startup.js';

export const WHISPER_DIR = path.join(os.homedir(), 'whisper.cpp');
export const MODELS_DIR = path.join(WHISPER_DIR, 'models');
const CACHE_DIR = path.join(os.homedir(), '.jarvis-dev', 'downloads');

export const MODELS = {
  tiny: {
    label: 'tiny (~75MB, mais rápido, menos preciso)',
    file: 'ggml-tiny.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  },
  base: {
    label: 'base (~150MB, equilibrado — recomendado)',
    file: 'ggml-base.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  },
  small: {
    label: 'small (~500MB, melhor qualidade, mais lento)',
    file: 'ggml-small.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  },
};

export function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Whisper (parte existente) ───────────────────────────────────────────

export function pickWhisperAsset(assets, env = {}) {
  const platform = env.platform || process.platform;
  const arch = env.arch || process.arch;

  if (platform === 'linux') return null;

  const zips = assets.filter(
    (a) => /\.zip$/i.test(a.name) && /bin/i.test(a.name)
  );

  if (zips.length === 0) return null;

  const patterns = [];
  if (platform === 'win32') {
    if (arch === 'x64') {
      patterns.push(/whisper-bin-x64/i);
      patterns.push(/whisper-blas-bin-x64/i);
      patterns.push(/whisper.*x64.*\.zip$/i);
    } else if (arch === 'arm64') {
      patterns.push(/whisper-bin-arm64/i);
      patterns.push(/whisper.*arm64.*\.zip$/i);
    }
    patterns.push(/whisper.*bin.*\.zip$/i);
  } else if (platform === 'darwin') {
    patterns.push(/whisper.*bin.*\.zip$/i);
  }

  for (const re of patterns) {
    const found = zips.find((a) => re.test(a.name));
    if (found) return found;
  }

  return null;
}

export async function downloadWithProgress(url, destPath, onProgress) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Download falhou: ${res.status} ${res.statusText}`);
  }
  const total = Number(res.headers.get('content-length') || 0);
  let downloaded = 0;

  const counter = new Transform({
    transform(chunk, _enc, cb) {
      downloaded += chunk.length;
      if (onProgress) onProgress(downloaded, total);
      cb(null, chunk);
    },
  });

  ensureDir(path.dirname(destPath));
  await pipeline(Readable.fromWeb(res.body), counter, fs.createWriteStream(destPath));
  return downloaded;
}

export function extractZip(zipPath, destDir) {
  ensureDir(destDir);

  if (process.platform === 'win32') {
    const res = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
      ],
      { stdio: 'inherit' }
    );
    if (res.status !== 0) throw new Error('Expand-Archive falhou');
    return;
  }

  const res = spawnSync('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('unzip falhou');
}

async function fetchLatestWhisperAsset() {
  const res = await fetch(
    'https://api.github.com/repos/ggerganov/whisper.cpp/releases/latest',
    { headers: { 'User-Agent': 'jarvis-voice-setup' } }
  );
  if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
  const data = await res.json();
  return pickWhisperAsset(data.assets || []);
}

async function setupWhisperBinary() {
  const existing = detectWhisper();
  if (existing.ok) {
    success(`whisper.cpp já instalado: ${existing.path}`);
    return existing.path;
  }

  if (process.platform === 'linux') {
    warn('No Linux, o whisper.cpp não vem pré-compilado.');
    dim('  Compile manualmente:');
    dim('    git clone https://github.com/ggerganov/whisper.cpp');
    dim('    cd whisper.cpp && make');
    dim('  Depois rode: jarvis voz --config');
    return null;
  }

  const spin = spinner('Buscando release mais recente do whisper.cpp...');
  spin.start();

  let asset;
  try {
    asset = await fetchLatestWhisperAsset();
  } catch (err) {
    spin.fail(`Falha ao buscar release: ${err.message}`);
    return null;
  }

  if (!asset) {
    spin.fail('Nenhum binário compatível encontrado.');
    dim('  Baixe manualmente: https://github.com/ggerganov/whisper.cpp/releases');
    return null;
  }

  spin.succeed(`Release encontrada: ${asset.name}`);

  const zipPath = path.join(CACHE_DIR, asset.name);
  const dl = spinner(`Baixando ${asset.name}...`);
  dl.start();

  try {
    const size = await downloadWithProgress(asset.browser_download_url, zipPath, (cur, total) => {
      if (total > 0) {
        const pct = Math.round((cur / total) * 100);
        dl.message = `Baixando ${asset.name}... ${pct}%`;
      }
    });
    dl.succeed(`Baixado (${(size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err) {
    dl.fail(`Download falhou: ${err.message}`);
    return null;
  }

  const ex = spinner('Extraindo...');
  ex.start();
  try {
    extractZip(zipPath, WHISPER_DIR);
    ex.succeed(`Extraído em ${WHISPER_DIR}`);
  } catch (err) {
    ex.fail(`Extração falhou: ${err.message}`);
    return null;
  }

  const after = detectWhisper();
  if (!after.ok) {
    warn('whisper.cpp extraído, mas o executável não foi localizado.');
    dim(`  Confira o conteúdo de ${WHISPER_DIR} e rode: jarvis voz --config`);
    return null;
  }

  return after.path;
}

async function setupModel(modelKey) {
  const modelInfo = MODELS[modelKey];
  if (!modelInfo) throw new Error(`Modelo desconhecido: ${modelKey}`);

  const destPath = path.join(MODELS_DIR, modelInfo.file);
  if (fs.existsSync(destPath)) {
    success(`Modelo já existe: ${modelInfo.file}`);
    return destPath;
  }

  ensureDir(MODELS_DIR);

  const sp = spinner(`Baixando ${modelInfo.file}...`);
  sp.start();

  try {
    const size = await downloadWithProgress(modelInfo.url, destPath, (cur, total) => {
      if (total > 0) {
        const pct = Math.round((cur / total) * 100);
        sp.message = `Baixando ${modelInfo.file}... ${pct}%`;
      }
    });
    sp.succeed(`Modelo baixado (${(size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err) {
    sp.fail(`Falha: ${err.message}`);
    return null;
  }

  return destPath;
}

// ─── Vosk (novo) ─────────────────────────────────────────────────────────

/**
 * Setup do Vosk — instala pacote Python (orientação) e baixa modelo.
 * @param {{ voskModel?: 'small-pt'|'full-pt' }} [opts]
 */
async function setupVosk(opts = {}) {
  const cfg = readVoiceConfig();
  const deps = checkVoskDependencies(cfg);

  // 1. Python + pacote vosk
  if (deps.python.ok) {
    success(`Python com vosk OK: ${deps.python.python.label}`);
  } else {
    warn('Python ou pacote vosk ausente.');
    console.log(deps.python.reason);
    blank();
  }

  // 2. Modelo
  const modelKey = opts.voskModel || 'small-pt';
  const modelInfo = VOSK_MODELS[modelKey];

  if (!modelInfo) {
    error(`Modelo Vosk desconhecido: ${modelKey}`);
    return { ok: false };
  }

  section(`Modelo: ${modelInfo.label}`);

  let modelPath = null;
  let modelSize = 0;

  const expectedDir = getVoskModelDir(modelInfo.name);
  if (fs.existsSync(expectedDir) && deps.model.ok && deps.model.path === expectedDir) {
    success(`Modelo já instalado: ${modelInfo.name}`);
    modelPath = expectedDir;
    const installed = listInstalledVoskModels().find((m) => m.path === expectedDir);
    modelSize = installed ? installed.sizeBytes : estimateDirSize(expectedDir);
  } else {
    const sp = spinner(`Baixando ${modelInfo.name}...`);
    sp.start();
    try {
      const res = await downloadVoskModel(modelKey, {
        onProgress: (cur, total) => {
          if (total > 0) {
            const pct = Math.round((cur / total) * 100);
            sp.message = `Baixando ${modelInfo.name}... ${pct}%`;
          }
        },
      });
      modelPath = res.path;
      modelSize = res.sizeBytes;
      sp.succeed(`Modelo baixado e extraído (${formatBytes(res.sizeBytes)})`);
    } catch (err) {
      sp.fail(`Falha: ${err.message}`);
      return { ok: false };
    }
  }

  // 3. Persiste na config
  const patch = {};
  if (modelPath) patch.voskModelPath = modelPath;
  if (deps.python.ok) {
    patch.voskPythonCmd = deps.python.python.cmd;
    patch.voskPythonArgs = deps.python.python.args;
  }
  if (Object.keys(patch).length > 0) updateVoiceConfig(patch);

  return {
    ok: Boolean(modelPath) && deps.python.ok,
    modelPath,
    modelSize,
    python: deps.python.python || null,
  };
}

// ─── Fluxo principal do --setup ──────────────────────────────────────────

/**
 * Fluxo do `jarvis voz --setup`.
 * @param {{
 *   model?: string,
 *   engine?: 'whisper'|'vosk',
 *   voskModel?: 'small-pt'|'full-pt',
 * }} [opts]
 */
export const PIPER_VOICES = {
  'pt_BR-faber-medium': {
    label: 'Faber (masculino, medium, ~63MB) - recomendado, licenca CC0',
  },
  'pt_BR-cadu-medium': {
    label: 'Cadu (masculino, medium, ~63MB)',
  },
  'pt_BR-edresson-low': {
    label: 'Edresson (masculino, low, ~20MB - mais leve)',
  },
  'pt_BR-jeff-medium': {
    label: 'Jeff (masculino, medium, ~63MB)',
  },
};

/**
 * Setup do Piper - instala pacote Python (orientacao) e baixa modelo PT-BR.
 *
 * @param {{ piperModel?: string }} [opts]
 */
async function setupPiper(opts = {}) {
  const cfg = readVoiceConfig();

  const deps = checkPiperDependencies(cfg);
  if (deps.python.ok) {
    success(`Python com piper-tts OK: ${deps.python.python.label}`);
  } else {
    warn('Python ou pacote piper-tts ausente.');
    console.log(deps.python.reason);
    blank();
    dim('  Instale com:');
    dim('    pip install piper-tts');
    blank();
    return { ok: false };
  }

  const modelKey = opts.piperModel || 'pt_BR-faber-medium';
  if (!PIPER_VOICES[modelKey]) {
    error(`Modelo Piper desconhecido: ${modelKey}`);
    dim('  Disponiveis: ' + Object.keys(PIPER_VOICES).join(', '));
    return { ok: false };
  }

  section(`Modelo: ${PIPER_VOICES[modelKey].label}`);

  const modelPath = path.join(PIPER_MODELS_DIR, `${modelKey}.onnx`);
  const jsonPath = modelPath + '.json';
  let finalModelPath = null;

  if (fs.existsSync(modelPath) && fs.existsSync(jsonPath)) {
    success(`Modelo ja instalado: ${modelKey}`);
    finalModelPath = modelPath;
  } else {
    const sp = spinner(`Baixando ${modelKey}...`);
    sp.start();

    try {
      const args = [
        ...deps.python.python.args,
        '-m', 'piper.download_voices',
        modelKey,
        '--data-dir', PIPER_MODELS_DIR,
      ];

      const res = spawnSync(deps.python.python.cmd, args, {
        encoding: 'utf-8',
        timeout: 300000,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
        },
      });

      if (res.status !== 0) {
        const stderr = String(res.stderr || '').trim();
        const lastLines = stderr.split('\n').slice(-3).join(' | ');
        sp.fail(`Download falhou: ${lastLines || 'erro desconhecido'}`);
        return { ok: false };
      }

      if (!fs.existsSync(modelPath) || !fs.existsSync(jsonPath)) {
        sp.fail('Download concluiu mas os arquivos do modelo nao foram encontrados.');
        dim(`  Esperado em: ${PIPER_MODELS_DIR}`);
        return { ok: false };
      }

      finalModelPath = modelPath;
      sp.succeed(`Modelo baixado: ${modelKey}`);
    } catch (err) {
      sp.fail(`Falha: ${err.message}`);
      return { ok: false };
    }
  }

  updateVoiceConfig({
    ttsEngine: 'piper',
    piperModelPath: finalModelPath,
    piperPythonCmd: deps.python.python.cmd,
    piperPythonArgs: deps.python.python.args,
  });

  return {
    ok: true,
    modelPath: finalModelPath,
    python: deps.python.python,
  };
}

export async function runVoiceSetup(opts = {}) {
  printBanner();

  const engine = opts.engine || 'whisper';

  if (engine === 'piper') {
    info('Configuracao do Jarvis Voz - engine Piper (TTS neural local)');
    blank();

    const piperResult = await setupPiper(opts);
    blank();

    printBox(
      `${chalk.bold('engine')}     piper\n` +
      `${chalk.bold('python')}     ${piperResult.python ? piperResult.python.label : muted('ausente')}\n` +
      `${chalk.bold('modelo')}     ${piperResult.modelPath ? path.basename(piperResult.modelPath) : muted('nao configurado')}\n` +
      `${chalk.bold('tts')}        ${piperResult.ok ? 'ativado' : muted('nao configurado')}\n` +
      `${chalk.bold('config')}     ${path.join(os.homedir(), '.jarvis-dev', 'voice.json')}`,
      { title: 'resultado', borderColor: 'green' }
    );
    blank();

    if (piperResult.ok) {
      success('Piper configurado.');
      dim('  Teste: jarvis voz "status do projeto" --run');
      dim('  Para voltar pro SAPI: edite voice.json e mude ttsEngine para "sapi"');
    } else {
      warn('Alguma etapa ficou pendente. Veja os avisos acima.');
    }
    blank();
    return;
  }

  if (engine === 'vosk') {
    info('Configuração do Jarvis Voz — engine Vosk (wake word)');
    blank();

    const recorder = detectRecorder();
    if (recorder.ok) {
      success(`Gravador OK: ${recorder.type} — ${recorder.path}`);
    } else {
      warn('Gravador de áudio não encontrado.');
      console.log(recorder.reason);
      blank();
    }

    const voskResult = await setupVosk(opts);
    blank();

    printBox(
      `${chalk.bold('engine')}     vosk\n` +
      `${chalk.bold('python')}     ${voskResult.python ? voskResult.python.label : muted('ausente')}\n` +
      `${chalk.bold('modelo')}     ${voskResult.modelPath ? path.basename(voskResult.modelPath) : muted('não configurado')}\n` +
      `${chalk.bold('tamanho')}    ${voskResult.modelSize ? formatBytes(voskResult.modelSize) : muted('-')}\n` +
      `${chalk.bold('gravador')}   ${recorder.ok ? recorder.type : muted('ausente')}\n` +
      `${chalk.bold('config')}     ${path.join(os.homedir(), '.jarvis-dev', 'voice.json')}`,
      { title: 'resultado', borderColor: 'green' }
    );
    blank();

    if (voskResult.ok) {
      success('Vosk configurado. Quando quiser testar: jarvis voz --wake');
    } else {
      warn('Alguma etapa ficou pendente. Veja os avisos acima.');
    }
    blank();
    return;
  }

  // Engine whisper (comportamento original)
  info('Configuração do Jarvis Voz — engine whisper (transcrição)');
  blank();

  const recorder = detectRecorder();
  if (recorder.ok) {
    success(`Gravador OK: ${recorder.type} — ${recorder.path}`);
  } else {
    warn('Gravador de áudio não encontrado.');
    console.log(recorder.reason);
    blank();
  }

  const whisperPath = await setupWhisperBinary();
  blank();

  const modelKey = opts.model || 'base';
  section(`Modelo: ${MODELS[modelKey].label}`);
  const modelPath = await setupModel(modelKey);
  blank();

  const patch = {};
  if (whisperPath) patch.whisperPath = whisperPath;
  if (modelPath) patch.modelPath = modelPath;
  if (Object.keys(patch).length > 0) updateVoiceConfig(patch);

  printBox(
    `${chalk.bold('engine')}     whisper\n` +
    `${chalk.bold('whisper')}    ${whisperPath || muted('não configurado')}\n` +
    `${chalk.bold('modelo')}     ${modelPath ? path.basename(modelPath) : muted('não configurado')}\n` +
    `${chalk.bold('gravador')}   ${recorder.ok ? recorder.type : muted('ausente')}\n` +
    `${chalk.bold('config')}     ${path.join(os.homedir(), '.jarvis-dev', 'voice.json')}`,
    { title: 'resultado', borderColor: 'green' }
  );
  blank();

  if (whisperPath && modelPath) {
    success('Tudo pronto. Quando quiser testar: jarvis voz --ouvir');
    dim('  Ajuste o microfone (se necessário): jarvis voz --config');
  } else {
    warn('Alguma etapa ficou pendente. Veja os avisos acima.');
  }
  blank();
}

// ─── Startup ─────────────────────────────────────────────────────────────

export function runInstallStartup() {
  printBanner();
  info('Instalação do Jarvis Voz no startup do Windows');
  blank();

  if (isStartupInstalled()) {
    success('Startup já está instalado.');
    dim(`  Arquivo: ${getStartupPath()}`);
    blank();
    dim('Para remover, rode: jarvis voz --remover-startup');
    return;
  }

  const result = installStartup();
  if (!result.ok) {
    error(result.reason);
    return;
  }

  success('Atalho de startup criado.');
  blank();
  printBox(
    `${chalk.bold('Arquivo')}   ${result.path}\n\n` +
    `${muted('A partir do próximo login, o Jarvis Voz vai iniciar')}\n` +
    `${muted('automaticamente em modo wake word, minimizado.')}\n\n` +
    `${muted('Para remover:')} jarvis voz --remover-startup`,
    { title: 'startup configurado', borderColor: 'green' }
  );
  blank();
}

export function runRemoveStartup() {
  printBanner();
  info('Remoção do Jarvis Voz do startup');
  blank();

  const result = removeStartup();
  if (!result.ok) {
    error(result.reason);
    return;
  }

  if (!result.removed) {
    info('Startup não estava instalado.');
    return;
  }

  success(`Removido: ${result.path}`);
}