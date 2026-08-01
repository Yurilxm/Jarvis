import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const JARVIS_DIR = path.join(os.homedir(), '.jarvis');
const PROFILE_PATH = path.join(JARVIS_DIR, 'config.json');

/**
 * Garante que o diretório .jarvis existe.
 */
function ensureDir() {
  if (!fs.existsSync(JARVIS_DIR)) {
    fs.mkdirSync(JARVIS_DIR, { recursive: true });
  }
}

/**
 * Lê o perfil salvo localmente.
 * @returns {object|null}
 */
export function loadProfile() {
  try {
    if (!fs.existsSync(PROFILE_PATH)) return null;
    const raw = fs.readFileSync(PROFILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Salva o perfil localmente.
 * @param {object} profile
 */
export function saveProfile(profile) {
  ensureDir();
  const data = {
    version: 1,
    ...profile,
    updatedAt: new Date().toISOString(),
    createdAt: profile.createdAt || new Date().toISOString(),
  };
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Remove o perfil local.
 */
export function deleteProfile() {
  if (fs.existsSync(PROFILE_PATH)) {
    fs.unlinkSync(PROFILE_PATH);
  }
}