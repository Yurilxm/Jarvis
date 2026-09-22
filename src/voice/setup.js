import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { updateVoiceConfig } from './config.js';
import {
  detectRecorder,
  detectWhisper,
  detectWhisperModel,
} from './dependencies.js';
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

/**
 * Escolhe o asset correto da release do whisper.cpp para a plataforma atual.
 * Retorna o objeto do asset ({ name, browser_download_url }) ou null.
 *
 * @param {Array<{name:string,browser_download_url:string}>} assets
 * @param {{ platform?: string, arch?: string }} [env]
 * @returns {{name:string,browser_download_url:string}|null}
 */
export function pickWhisperAsset(assets, env = {}) {
  const platform = env.platform || process.platform;
  const arch = env.arch || process.arch;

  if (platform === 'linux') return null;

  // Filtra apenas assets que pareçam binários pré-compilados (têm "bin" e ".zip").
  // Ignora "source code" (que o GitHub sempre inclui).
  const zips = assets.filter(
    (a) => /\.zip$/i.test(a.name) && /bin/i.test(a.name)
  );

  if (zips.length === 0) return null;

  // Prioridade por arquitetura
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

/**
 * Fluxo do `jarvis voz --setup`.
 * @param {{ model?: string }} [opts]
 */
export async function runVoiceSetup(opts = {}) {
  printBanner();
  info('Configuração do Jarvis Voz');
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