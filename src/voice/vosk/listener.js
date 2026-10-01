import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

const WAKE_MARKER = "__WAKE__";
const READY_MARKER = "READY";
const STOPPED_MARKER = "STOPPED";

/**
 * Interpreta uma linha do stdout do script Python.
 * Funcao pura — testavel.
 *
 * @param {string} line
 * @returns {{ type: 'wake' } | { type: 'ready' } | { type: 'stopped' } | { type: 'log', text: string } | null}
 */
export function parseVoskLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;
  if (trimmed === WAKE_MARKER) return { type: "wake" };
  if (trimmed === READY_MARKER) return { type: "ready" };
  if (trimmed === STOPPED_MARKER) return { type: "stopped" };
  return { type: "log", text: trimmed };
}

/**
 * Cria um listener Vosk. Gerencia o processo Python persistente e
 * expoe metodos para alimentar audio e receber eventos.
 *
 * Eventos:
 *   'ready'   — modelo carregado, pronto para receber audio
 *   'wake'    — wake word detectada
 *   'stopped' — processo encerrou normalmente
 *   'log'     — linha de log qualquer (string)
 *   'error'   — erro no processo
 *   'close'   — processo encerrou (qualquer motivo)
 *
 * @param {{
 *   pythonCmd: string,
 *   pythonArgs?: string[],
 *   scriptPath: string,
 *   modelPath: string,
 * }} options
 * @returns {{
 *   on: (event: string, cb: Function) => void,
 *   once: (event: string, cb: Function) => void,
 *   write: (chunk: Buffer|string) => void,
 *   stop: () => void,
 *   isReady: () => boolean,
 *   isStopped: () => boolean,
 * }}
 */
export function createVoskListener(options) {
  const {
    pythonCmd,
    pythonArgs = [],
    scriptPath,
    modelPath,
  } = options;

  const emitter = new EventEmitter();
  // Espelha env pra que JARVIS_VOSK_DEBUG chegue no Python
  const child = spawn(pythonCmd, [...pythonArgs, scriptPath, modelPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  let stdoutBuf = "";
  let ready = false;
  let stopped = false;

  child.stdout.setEncoding("utf-8");
  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk;
    let idx;
    while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
      const raw = stdoutBuf.slice(0, idx);
      stdoutBuf = stdoutBuf.slice(idx + 1);
      const parsed = parseVoskLine(raw);
      if (!parsed) continue;
      if (parsed.type === "wake") emitter.emit("wake");
      else if (parsed.type === "ready") {
        ready = true;
        emitter.emit("ready");
      } else if (parsed.type === "stopped") {
        emitter.emit("stopped");
      } else if (parsed.type === "log") {
        emitter.emit("log", parsed.text);
      }
    }
  });

  child.stderr.setEncoding("utf-8");
  child.stderr.on("data", (chunk) => {
    emitter.emit("log", String(chunk).trim());
  });

  child.on("error", (err) => {
    emitter.emit("error", err);
  });

  child.on("close", (code) => {
    stopped = true;
    emitter.emit("close", code);
  });

  return {
    on: (event, cb) => emitter.on(event, cb),
    once: (event, cb) => emitter.once(event, cb),

    write(chunk) {
      if (stopped) return;
      if (!child.stdin || !child.stdin.writable) return;
      try {
        child.stdin.write(chunk);
      } catch {
        // ignora — processo pode ter encerrado entre o check e o write
      }
    },

    stop() {
      if (stopped) return;
      stopped = true;
      try { child.stdin.end(); } catch { /* ignore */ }
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* ignore */ }
      }, 1000).unref();
    },

    isReady: () => ready,
    isStopped: () => stopped,
  };
}
