import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Gera um caminho temporário para o WAV.
 * @returns {string}
 */
export function getTempWavPath() {
  const dir = path.join(os.tmpdir(), 'jarvis-voz');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const name = `captura-${Date.now()}.wav`;
  return path.join(dir, name);
}

/**
 * Monta os argumentos do ffmpeg para gravar áudio.
 * @param {{ type: 'ffmpeg'|'sox', audioDevice: string|null, outputPath: string }} opts
 * @returns {string[]}
 */
export function buildRecorderArgs({ type, audioDevice, outputPath }) {
  if (type === 'ffmpeg') {
    if (process.platform === 'win32') {
      const device = audioDevice || 'default';
      return [
        '-y',
        '-f', 'dshow',
        '-i', `audio=${device}`,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        outputPath,
      ];
    }
    if (process.platform === 'darwin') {
      return [
        '-y',
        '-f', 'avfoundation',
        '-i', ':0',
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        outputPath,
      ];
    }
    // Linux: tenta ALSA default
    return [
      '-y',
      '-f', 'alsa',
      '-i', 'default',
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      outputPath,
    ];
  }

  if (type === 'sox') {
    // sox -d -r 16000 -c 1 -b 16 output.wav
    return ['-d', '-r', '16000', '-c', '1', '-b', '16', outputPath];
  }

  throw new Error(`Gravador desconhecido: ${type}`);
}

/**
 * Grava áudio do microfone até o callback `stop()` ser chamado.
 *
 * @param {{
 *   recorderPath: string,
 *   type: 'ffmpeg'|'sox',
 *   audioDevice: string|null,
 *   maxDurationMs?: number,
 * }} options
 * @returns {Promise<{ outputPath: string, stopped: boolean, reason: 'manual'|'timeout' }>}
 */
export function startRecording(options) {
  const {
    recorderPath,
    type,
    audioDevice,
    maxDurationMs = 30000,
  } = options;

  const outputPath = getTempWavPath();
  const args = buildRecorderArgs({ type, audioDevice, outputPath });

  const child = spawn(recorderPath, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let stderrBuf = '';
  child.stderr.on('data', (chunk) => {
    stderrBuf += chunk.toString();
    if (stderrBuf.length > 8000) stderrBuf = stderrBuf.slice(-8000);
  });

  let timeoutHandle = null;
  let stopped = false;
  let reason = 'manual';

  const promise = new Promise((resolve, reject) => {
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      // Envia sinal de encerramento — ffmpeg interpreta como fim gracioso
      try { child.kill('SIGINT'); } catch { /* ignore */ }
    };

    const stopWithReason = (r) => {
      reason = r;
      stop();
    };

    timeoutHandle = setTimeout(() => stopWithReason('timeout'), maxDurationMs);

    child.on('error', (err) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      reject(new Error(`Falha ao iniciar gravador: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);

      if (!fs.existsSync(outputPath)) {
        const detail = stderrBuf.trim().split('\n').slice(-5).join('\n');
        reject(new Error(
          `Gravador encerrou sem produzir arquivo (code=${code}, signal=${signal}).\n` +
          (detail ? `  Últimas linhas:\n${detail}` : '  Verifique o microfone e o dispositivo configurado.')
        ));
        return;
      }

      resolve({ outputPath, stopped: true, reason });
    });

    // Expõe o stop para o chamador
    promise.stop = stopWithReason;
  });

  return promise;
}

/**
 * Inicia um stream de áudio PCM 16kHz mono 16-bit do microfone,
 * escrevendo para stdout do processo gravador. Usado pelo wake word.
 *
 * @param {{
 *   recorderPath: string,
 *   type: 'ffmpeg'|'sox',
 *   audioDevice: string|null,
 * }} options
 * @returns {{ child: import('node:child_process').ChildProcess, stream: NodeJS.ReadableStream, stop: () => void }}
 */
export function startAudioStream(options) {
  const { recorderPath, type, audioDevice } = options;

  // Argumentos equivalentes ao startRecording, mas escrevendo para pipe:1
  let args;
  if (type === 'ffmpeg') {
    if (process.platform === 'win32') {
      args = [
        '-f', 'dshow',
        '-i', `audio=${audioDevice || 'default'}`,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-f', 's16le',
        '-',
      ];
    } else if (process.platform === 'darwin') {
      args = [
        '-f', 'avfoundation',
        '-i', ':0',
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-f', 's16le',
        '-',
      ];
    } else {
      args = [
        '-f', 'alsa',
        '-i', 'default',
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-f', 's16le',
        '-',
      ];
    }
  } else if (type === 'sox') {
    args = ['-d', '-r', '16000', '-c', '1', '-b', '16', '-t', 'raw', '-'];
  } else {
    throw new Error(`Gravador desconhecido: ${type}`);
  }

  const child = spawn(recorderPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stream = child.stdout;

  const stop = () => {
    try { child.kill('SIGINT'); } catch { /* ignore */ }
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
  };

  return { child, stream, stop };
}