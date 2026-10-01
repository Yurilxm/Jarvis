import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const VOSK_MODELS_DIR = path.join(os.homedir(), '.jarvis-dev', 'vosk-models');
const DOWNLOADS_DIR = path.join(os.homedir(), '.jarvis-dev', 'downloads');

/**
 * Catálogo de modelos Vosk disponíveis para download.
 * O small-pt é suficiente para wake word + comandos curtos.
 * O full-pt é maior e mais preciso, mas bem mais lento.
 */
export const VOSK_MODELS = {
  'small-pt': {
    name: 'vosk-model-small-pt-0.3',
    label: 'small-pt (~31MB, wake word + comandos curtos — recomendado)',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip',
  },
  'full-pt': {
    name: 'vosk-model-pt-fb-v0.1.1-20220516_2113',
    label: 'full-pt (~1.6GB, reconhecimento geral completo)',
    url: 'https://alphacephei.com/vosk/models/vosk-model-pt-fb-v0.1.1-20220516_2113.zip',
  },
};

/**
 * Caminho esperado de um modelo após extração.
 * @param {string} modelName - ex: 'vosk-model-small-pt-0.3'
 * @returns {string}
 */
export function getVoskModelDir(modelName) {
  return path.join(VOSK_MODELS_DIR, modelName);
}

/**
 * Verifica se uma pasta contem um modelo Vosk valido.
 * Aceita os dois formatos:
 *   - Novo (Vosk >= 0.3):  subpastas am/, conf/, graph/
 *   - Antigo (Kaldi):      final.mdl + mfcc.conf + (HCLr.fst ou Gr.fst) no root
 *
 * @param {string} modelDir
 * @returns {boolean}
 */
/**
 * Verifica se uma pasta contem um modelo Vosk valido.
 * Aceita os dois formatos:
 *   - Novo (Vosk >= 0.3):  subpastas am/, conf/, graph/
 *   - Antigo (Kaldi):      final.mdl + mfcc.conf + (HCLr.fst ou Gr.fst) no root
 *
 * @param {string} modelDir
 * @returns {boolean}
 */
export function isVoskModelValid(modelDir) {
  if (!modelDir || !fs.existsSync(modelDir)) return false;

  let stat;
  try {
    stat = fs.statSync(modelDir);
  } catch {
    return false;
  }
  if (!stat.isDirectory()) return false;

  let entries;
  try {
    entries = fs.readdirSync(modelDir, { withFileTypes: true });
  } catch {
    return false;
  }

  const isDir = (name) => entries.some((e) => e.name === name && e.isDirectory());
  const isFile = (name) => entries.some((e) => e.name === name && e.isFile());

  // Formato novo: am/, conf/, graph/ (os tres DEVEM ser diretorios)
  if (isDir('am') && isDir('conf') && isDir('graph')) return true;

  // Formato antigo (Kaldi): final.mdl + mfcc.conf + HCLr.fst ou Gr.fst
  if (isFile('final.mdl') && isFile('mfcc.conf')) {
    if (isFile('HCLr.fst') || isFile('Gr.fst')) return true;
  }

  return false;
}

/**
 * Lista modelos Vosk instalados em ~/.jarvis-dev/vosk-models/.
 * @returns {Array<{ name: string, path: string, sizeBytes: number }>}
 */
export function listInstalledVoskModels() {
  if (!fs.existsSync(VOSK_MODELS_DIR)) return [];
  try {
    return fs.readdirSync(VOSK_MODELS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => {
        const full = path.join(VOSK_MODELS_DIR, e.name);
        return {
          name: e.name,
          path: full,
          sizeBytes: estimateDirSize(full),
        };
      })
      .filter((m) => isVoskModelValid(m.path));
  } catch {
    return [];
  }
}

/**
 * Soma recursivamente o tamanho de uma pasta em bytes.
 * @param {string} dir
 * @returns {number}
 */
export function estimateDirSize(dir) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += estimateDirSize(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          // ignora
        }
      }
    }
  } catch {
    // ignora
  }
  return total;
}

/**
 * Formata bytes para texto humano.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const rounded = Math.round(n * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${str} ${units[i]}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function downloadWithProgress(url, destPath, onProgress) {
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

function extractZip(zipPath, destDir) {
  ensureDir(destDir);

  if (process.platform === 'win32') {
    // tar e nativo no Windows 10+ e extrai sem criar subpasta aninhada
    const tar = spawnSync('tar', ['-xf', zipPath, '-C', destDir], { stdio: 'inherit' });
    if (tar.status === 0) return;

    // Fallback: Expand-Archive
    const res = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
      ],
      { stdio: 'inherit' }
    );
    if (res.status !== 0) throw new Error('Extracao falhou (tar e Expand-Archive)');
    return;
  }

  const res = spawnSync('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('unzip falhou');
}

/**
 * Procura recursivamente uma pasta que contenha am/, conf/ e graph/.
 * Lida com aninhamento criado por ferramentas de extracao.
 *
 * @param {string} rootDir
 * @param {number} [maxDepth=3]
 * @returns {string|null}
 */
export function findValidVoskModelDir(rootDir, maxDepth = 3) {
  if (!rootDir || !fs.existsSync(rootDir)) return null;
  if (isVoskModelValid(rootDir)) return rootDir;
  if (maxDepth <= 0) return null;

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sub = path.join(rootDir, entry.name);
    const found = findValidVoskModelDir(sub, maxDepth - 1);
    if (found) return found;
  }
  return null;
}

/**
 * Achata um modelo aninhado: se o validDir esta dentro de targetDir
 * (ex: targetDir/targetDir/am), move o modelo para targetDir direto.
 *
 * @param {string} validDir
 * @param {string} targetDir
 * @returns {string} caminho final do modelo
 */
function flattenVoskModel(validDir, targetDir) {
  if (validDir === targetDir) return validDir;

  try {
    if (validDir.startsWith(targetDir + path.sep)) {
      // validDir esta DENTRO de targetDir — move para tmp, limpa, move de volta
      const tmp = targetDir + '__tmp_' + Date.now();
      fs.renameSync(validDir, tmp);
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.renameSync(tmp, targetDir);
      return targetDir;
    }

    // validDir esta FORA de targetDir
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.renameSync(validDir, targetDir);
    return targetDir;
  } catch {
    return validDir;
  }
}

/**
 * Baixa e extrai um modelo Vosk.
 * Retorna o caminho da pasta do modelo extraído.
 *
 * @param {string} modelKey - 'small-pt' ou 'full-pt'
 * @param {{ onProgress?: (cur: number, total: number) => void }} [opts]
 * @returns {Promise<{ path: string, sizeBytes: number }>}
 */
export async function downloadVoskModel(modelKey, opts = {}) {
  const info = VOSK_MODELS[modelKey];
  if (!info) {
    throw new Error(`Modelo Vosk desconhecido: ${modelKey}`);
  }

  ensureDir(VOSK_MODELS_DIR);
  ensureDir(DOWNLOADS_DIR);

  const zipPath = path.join(DOWNLOADS_DIR, `${info.name}.zip`);
  const targetDir = getVoskModelDir(info.name);

  // Limpa destino antigo
  try {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } catch {
    // segue
  }

  // Baixa
  const downloaded = await downloadWithProgress(info.url, zipPath, opts.onProgress);

  // Extrai
  extractZip(zipPath, VOSK_MODELS_DIR);

  // Procura dir valido (lida com aninhamento)
  let modelDir =
    findValidVoskModelDir(targetDir, 4) ||
    findValidVoskModelDir(VOSK_MODELS_DIR, 4);

  if (!modelDir) {
    throw new Error(
      `Modelo extraido, mas a estrutura esta invalida em: ${targetDir}\n` +
      '  Esperado: subpastas am/, conf/ e graph/.'
    );
  }

  // Achata se ficou aninhado
  modelDir = flattenVoskModel(modelDir, targetDir);

  const sizeBytes = estimateDirSize(modelDir);

  try {
    fs.unlinkSync(zipPath);
  } catch {
    // silencioso
  }

  return { path: modelDir, sizeBytes, downloadedBytes: downloaded };
}