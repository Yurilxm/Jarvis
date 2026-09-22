import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.jarvis-dev');
const CONFIG_PATH = path.join(CONFIG_DIR, 'voice.json');

/**
 * Lê a config de voz (ou objeto vazio se não existir).
 * @returns {object}
 */
export function readVoiceConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Persiste a config de voz (merge com o que já existe).
 * @param {object} patch
 * @returns {object} config resultante
 */
export function updateVoiceConfig(patch) {
  const current = readVoiceConfig();
  const next = { ...current, ...patch };

  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf-8');
  } catch {
    // silencioso — o config é uma conveniência
  }

  return next;
}

export function getVoiceConfigPath() {
  return CONFIG_PATH;
}