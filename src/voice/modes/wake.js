import { runVoskWakeLoop } from "../vosk/wake-loop.js";

/**
 * Modo --wake: escuta continua com Vosk (Python, open source, offline).
 *
 * O codigo antigo (Porcupine/Picovoice) foi removido — o free tier foi
 * fechado e o Vosk cobre o caso de uso com vantagens (offline, sem conta).
 *
 * @param {{ confirm?: boolean }} [opts]
 */
export async function runWakeMode(opts = {}) {
  await runVoskWakeLoop({ confirm: opts.confirm });
}
