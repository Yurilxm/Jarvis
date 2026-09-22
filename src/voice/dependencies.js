import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { readVoiceConfig } from './config.js';

/**
 * Procura um executável no PATH.
 * @param {string} name
 * @returns {string|null} caminho absoluto ou null
 */
export function findInPath(name) {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'where' : 'which';
  try {
    const out = execFileSync(cmd, [name], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'], // silencia stderr do `where`
    }).trim();
    if (!out) return null;
    const first = out.split(/\r?\n/)[0].trim();
    return first || null;
  } catch {
    return null;
  }
}

/**
 * Detecta o gravador de áudio disponível.
 * Prioridade: config do usuário > ffmpeg no PATH > sox no PATH.
 *
 * @returns {{ ok: boolean, type?: 'ffmpeg'|'sox', path?: string, reason?: string }}
 */
export function detectRecorder() {
  const cfg = readVoiceConfig();

  // 1. Configuração explícita do usuário
  if (cfg.recorderPath && fs.existsSync(cfg.recorderPath)) {
    return { ok: true, type: cfg.recorderType || 'ffmpeg', path: cfg.recorderPath };
  }

  // 2. ffmpeg no PATH
  const ffmpeg = findInPath('ffmpeg');
  if (ffmpeg) {
    return { ok: true, type: 'ffmpeg', path: ffmpeg };
  }

  // 3. sox no PATH
  const sox = findInPath('sox');
  if (sox) {
    return { ok: true, type: 'sox', path: sox };
  }

  return {
    ok: false,
    reason:
      'Nenhum gravador de áudio encontrado.\n' +
      '  Instale ffmpeg (recomendado) ou sox e adicione ao PATH.\n' +
      '  Windows:  winget install Gyan.FFmpeg\n' +
      '  macOS:    brew install ffmpeg\n' +
      '  Linux:    sudo apt install ffmpeg',
  };
}

/**
 * Detecta o whisper.cpp.
 * Procura por whisper-cli, main ou whisper nos locais comuns + PATH.
 *
 * @returns {{ ok: boolean, path?: string, reason?: string }}
 */
export function detectWhisper() {
  const cfg = readVoiceConfig();

  // 1. Configuração explícita
  if (cfg.whisperPath && fs.existsSync(cfg.whisperPath)) {
    return { ok: true, path: cfg.whisperPath };
  }

  // 2. Candidatos conhecidos no PATH
  const candidates = ['whisper-cli', 'whisper', 'main'];
  for (const name of candidates) {
    const found = findInPath(name);
    if (found) return { ok: true, path: found };
  }

  // 3. Locais comuns (Windows)
  if (process.platform === 'win32') {
    const home = os.homedir();
    const guesses = [
      path.join(home, 'whisper.cpp', 'main.exe'),
      path.join(home, 'whisper.cpp', 'build', 'bin', 'Release', 'main.exe'),
      path.join(home, 'whisper.cpp', 'build', 'bin', 'main.exe'),
      'C:\\whisper.cpp\\main.exe',
      'C:\\whisper.cpp\\build\\bin\\Release\\main.exe',
    ];
    for (const g of guesses) {
      if (fs.existsSync(g)) return { ok: true, path: g };
    }
  }

  return {
    ok: false,
    reason:
      'whisper.cpp não encontrado.\n' +
      '  Instale em https://github.com/ggerganov/whisper.cpp e adicione ao PATH,\n' +
      '  ou configure o caminho com: jarvis voz --config',
  };
}

/**
 * Lista os modelos .bin disponíveis em uma pasta.
 * @param {string} dir
 * @returns {string[]}
 */
export function listWhisperModels(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.bin'))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Detecta um modelo padrão do whisper.
 * Prioridade: config > pasta do binário/models > ~/whisper.cpp/models.
 *
 * @param {string} whisperPath
 * @returns {{ ok: boolean, path?: string, reason?: string }}
 */
export function detectWhisperModel(whisperPath) {
  const cfg = readVoiceConfig();
  if (cfg.modelPath && fs.existsSync(cfg.modelPath)) {
    return { ok: true, path: cfg.modelPath };
  }

  // Pastas prováveis
  const dirs = [];
  if (whisperPath) {
    const binDir = path.dirname(whisperPath);
    dirs.push(path.join(binDir, 'models'));
    dirs.push(path.join(binDir, '..', 'models'));
    dirs.push(path.join(binDir, '..', '..', 'models'));
  }
  dirs.push(path.join(os.homedir(), 'whisper.cpp', 'models'));

  // Preferência por modelos "base" e "small" — boa relação qualidade/velocidade
  const preferenceOrder = [
    'ggml-small.bin',
    'ggml-base.bin',
    'ggml-medium.bin',
    'ggml-tiny.bin',
  ];

  for (const dir of dirs) {
    for (const name of preferenceOrder) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return { ok: true, path: p };
    }
  }

  // Fallback: qualquer .bin em qualquer pasta de candidatos
  for (const dir of dirs) {
    const models = listWhisperModels(dir);
    if (models.length > 0) return { ok: true, path: models[0] };
  }

  return {
    ok: false,
    reason:
      'Modelo do whisper.cpp não encontrado.\n' +
      '  Baixe em https://huggingface.co/ggerganov/whisper.cpp/tree/main\n' +
      '  Ex: ggml-base.bin (~150MB) ou ggml-small.bin (~500MB)\n' +
      '  Coloque em: ' + path.join(os.homedir(), 'whisper.cpp', 'models'),
  };
}

/**
 * Lista os dispositivos de áudio no Windows via ffmpeg (dshow).
 * No Linux/macOS, retorna null (usa default do sistema).
 *
 * @param {string} ffmpegPath
 * @returns {string[]|null}
 */
export function listAudioDevices(ffmpegPath) {
  if (process.platform !== 'win32') return null;

  try {
    const res = spawnSync(
      ffmpegPath,
      ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'],
      { encoding: 'utf-8', timeout: 10000 }
    );

    const output = `${res.stdout || ''}\n${res.stderr || ''}`;
    const devices = [];
    const re = /\[dshow[^\]]*\]\s+"([^"]+)"\s+\(audio\)/g;
    let m;
    while ((m = re.exec(output)) !== null) {
      devices.push(m[1]);
    }
    return devices;
  } catch {
    return null;
  }
}

/**
 * Checagem completa — retorna tudo que é necessário para a captura.
 * @returns {{
 *   recorder: object,
 *   whisper: object,
 *   model: object,
 *   audioDevice: string|null,
 *   ok: boolean,
 *   missing: string[],
 * }}
 */
export function checkVoiceDependencies() {
  const recorder = detectRecorder();
  const whisper = detectWhisper();
  const model = whisper.ok ? detectWhisperModel(whisper.path) : { ok: false };

  let audioDevice = null;
  const cfg = readVoiceConfig();
  if (cfg.audioDevice) {
    audioDevice = cfg.audioDevice;
  } else if (recorder.ok && recorder.type === 'ffmpeg') {
    const devices = listAudioDevices(recorder.path);
    if (devices && devices.length > 0) {
      audioDevice = devices[0];
    }
  }

  const missing = [];
  if (!recorder.ok) missing.push('recorder');
  if (!whisper.ok) missing.push('whisper');
  if (!model.ok) missing.push('model');

  return {
    recorder,
    whisper,
    model,
    audioDevice,
    ok: missing.length === 0,
    missing,
  };
}

/**
 * Verifica se o SDK do Porcupine está instalado (import dinâmico).
 * Retorna um objeto com o módulo importado ou com erro amigável.
 *
 * @returns {Promise<{ ok: boolean, module?: any, reason?: string }>}
 */
export async function detectPorcupine() {
  try {
    const mod = await import('@picovoice/porcupine-node');
    return { ok: true, module: mod };
  } catch {
    return {
      ok: false,
      reason:
        'A wake word requer o pacote "@picovoice/porcupine-node".\n' +
        '  Instale com: npm install @picovoice/porcupine-node\n' +
        '  (ou garanta que ele esteja em optionalDependencies e rode npm install)',
    };
  }
}

/**
 * Lê a AccessKey do Picovoice (env ou config).
 * @returns {string|null}
 */
export function getPicovoiceAccessKey() {
  if (process.env.PICOVOICE_ACCESS_KEY) return process.env.PICOVOICE_ACCESS_KEY;
  const cfg = readVoiceConfig();
  return cfg.picovoiceAccessKey || null;
}