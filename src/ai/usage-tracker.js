import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { existsSync, mkdirSync } from 'node:fs';
import { GEMINI_DAILY_LIMIT, GEMINI_WARNING_THRESHOLD } from '../config/env.js';

const USAGE_DIR = path.join(os.homedir(), '.jarvis');
const USAGE_PATH = path.join(USAGE_DIR, 'gemini-usage.json');

function ensureDir() {
  if (!existsSync(USAGE_DIR)) {
    mkdirSync(USAGE_DIR, { recursive: true });
  }
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readUsage() {
  try {
    const raw = await fs.readFile(USAGE_PATH, 'utf-8');
    const usage = JSON.parse(raw);
    return usage.date === getToday() ? usage : { date: getToday(), count: 0 };
  } catch {
    return { date: getToday(), count: 0 };
  }
}

async function writeUsage(usage) {
  ensureDir();
  await fs.writeFile(USAGE_PATH, JSON.stringify(usage, null, 2), 'utf-8');
}

function buildWarning(count) {
  if (count >= GEMINI_DAILY_LIMIT) {
    return `Cota diária da Gemini atingida (${count}/${GEMINI_DAILY_LIMIT}). As próximas requisições podem falhar.`;
  }
  if (count >= GEMINI_WARNING_THRESHOLD) {
    return `Atenção: ${count}/${GEMINI_DAILY_LIMIT} requisições da Gemini usadas hoje. Restam ${GEMINI_DAILY_LIMIT - count}.`;
  }
  return null;
}

export { buildWarning };

/**
 * Verifica a cota atual SEM incrementar.
 * @returns {Promise<{ warning: string|null }>}
 */
export async function checkUsage() {
  const usage = await readUsage();
  return { warning: buildWarning(usage.count) };
}

/**
 * Incrementa o contador de uso em +1.
 * Chame APENAS após uma requisição bem-sucedida.
 * @returns {Promise<{ warning: string|null }>}
 */
export async function incrementUsage() {
  const usage = await readUsage();
  usage.count++;
  await writeUsage(usage);
  return { warning: buildWarning(usage.count) };
}