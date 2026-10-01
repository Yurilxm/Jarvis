import { runVoskWakeLoop } from "../vosk/wake-loop.js";

/**
 * Modo --wake: escuta continua com Vosk (Python, open source, offline).
 *
 * Historico:
 *   Antes usava Porcupine (Picovoice), mas o free tier foi fechado.
 *   O codigo antigo ficou em src/voice/_legacy/wakeword.js.
 *
 * @param {{ confirm?: boolean }} [opts]
 */
export async function runWakeMode(opts = {}) {
  await runVoskWakeLoop({ confirm: opts.confirm });
}
