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
const WORD_NUMS = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, catorze: 14, quatorze: 14, quinze: 15,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
};

/**
 * Interpreta duracao natural em PT-BR a partir de uma frase.
 * Ex: "pausa por 30 minutos" -> 1800000
 *     "pausa por uma hora"  -> 3600000
 *     "pausa por meia hora" -> 1800000
 *     "pausa"               -> null (indefinido)
 *
 * @param {string} text
 * @returns {number|null} ms, ou null se nao houver duracao
 */
export function parseVoicePauseDuration(text) {
  if (!text) return null;
  const norm = String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // "hora e meia" / "uma hora e meia"
  if (/(uma\s+)?hora\s+e\s+meia/.test(norm)) return 90 * 60 * 1000;

  // "meia hora"
  if (/meia\s+hora/.test(norm)) return 30 * 60 * 1000;

  // Numerico: "2 horas" / "30 minutos" / "12h" / "30min"
  const hMatch = norm.match(/(\d+)\s*(?:h\b|hora|horas)/);
  if (hMatch) return Number(hMatch[1]) * 60 * 60 * 1000;

  const mMatch = norm.match(/(\d+)\s*(?:min\b|minuto|minutos|m\b)/);
  if (mMatch) return Number(mMatch[1]) * 60 * 1000;

  // Palavra numerica + hora/minuto
  const words = norm.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const n = WORD_NUMS[words[i]];
    if (n == null) continue;
    const next = words[i + 1] || "";
    if (/^(hora|horas|h)$/.test(next)) return n * 60 * 60 * 1000;
    if (/^(minuto|minutos|min|m)$/.test(next)) return n * 60 * 1000;
  }

  return null;
}

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
