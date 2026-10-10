import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STATE_DIR = path.join(os.homedir(), ".jarvis-dev");
const STATE_PATH = path.join(STATE_DIR, "voice-state.json");

/**
 * Le o estado atual. Retorna { paused: bool, until: number|null, pausedAt: number|null }.
 * Se o arquivo nao existir ou estiver corrompido, retorna estado "ativo".
 *
 * @returns {{ paused: boolean, until: number|null, pausedAt: number|null }}
 */
export function readVoiceState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { paused: false, until: null, pausedAt: null };
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
    const until = typeof raw.until === "number" ? raw.until : null;
    const pausedAt = typeof raw.pausedAt === "number" ? raw.pausedAt : null;

    // Se ja passou o tempo, considera ativo (e limpa o arquivo)
    if (raw.paused && until && Date.now() > until) {
      try { fs.unlinkSync(STATE_PATH); } catch { /* ignore */ }
      return { paused: false, until: null, pausedAt: null };
    }

    return {
      paused: Boolean(raw.paused),
      until,
      pausedAt,
    };
  } catch {
    return { paused: false, until: null, pausedAt: null };
  }
}

/**
 * Escreve o estado pausado.
 * @param {{ until?: number|null }} [opts] - timestamp de termino, ou null pra indefinido
 * @returns {{ ok: boolean, until: number|null, reason?: string }}
 */
export function pauseVoice(opts = {}) {
  const until = typeof opts.until === "number" ? opts.until : null;
  const payload = { paused: true, until, pausedAt: Date.now() };

  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(payload, null, 2), "utf-8");
    return { ok: true, until };
  } catch (err) {
    return { ok: false, until: null, reason: err.message };
  }
}

/**
 * Remove o estado pausado (retoma).
 * @returns {{ ok: boolean, wasPaused: boolean }}
 */
export function resumeVoice() {
  let wasPaused = false;
  try {
    if (fs.existsSync(STATE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
      wasPaused = Boolean(raw.paused);
      fs.unlinkSync(STATE_PATH);
    }
  } catch { /* ignore */ }
  return { ok: true, wasPaused };
}

/**
 * Converte string tipo "30m", "2h", "45s", "3d" em milissegundos.
 * Retorna null se invalido.
 *
 * @param {string} str
 * @returns {number|null}
 */
export function parseDuration(str) {
  if (!str || typeof str !== "string") return null;
  const m = str.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[unit];
  return n * mult;
}

/**
 * Formata um timestamp em texto humano tipo "23min" ou "1h45".
 *
 * @param {number} until
 * @returns {string}
 */
export function formatRemaining(until) {
  const ms = Math.max(0, until - Date.now());
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return sec + "s";
  const min = Math.floor(sec / 60);
  if (min < 60) return min + "min";
  const h = Math.floor(min / 60);
  const restMin = min % 60;
  return restMin > 0 ? h + "h" + restMin : h + "h";
}
