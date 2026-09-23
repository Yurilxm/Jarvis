import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { findInPath } from './dependencies.js';
import { readVoiceConfig } from './config.js';

/**
 * Toca um "plim" curto para sinalizar a wake word. Usa ffplay (que vem
 * com ffmpeg). Retorna true se o som foi disparado (assíncrono).
 *
 * @param {string} [customPath] - arquivo customizado (.wav/.mp3)
 * @returns {boolean}
 */
export function playWakeSound(customPath) {
  const cfg = readVoiceConfig();

  // Config pode desligar
  if (cfg.wakeSound === false) return false;

  const ffplay = findInPath('ffplay');
  if (!ffplay) return false;

  const path = customPath || cfg.wakeSoundPath;

  let args;
  if (path && fs.existsSync(path)) {
    args = ['-nodisp', '-autoexit', '-loglevel', 'quiet', path];
  } else {
    // Beep gerado on-the-fly: 880Hz por 120ms
    args = [
      '-nodisp', '-autoexit', '-loglevel', 'quiet',
      '-f', 'lavfi',
      '-i', 'sine=frequency=880:duration=0.12',
    ];
  }

  try {
    const child = spawn(ffplay, args, {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}