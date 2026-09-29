import { runVoiceSetup, runInstallStartup, runRemoveStartup } from './setup.js';
import { runListenMode } from './modes/listen.js';
import { runWakeMode } from './modes/wake.js';
import { runConfigMode, runListMicsMode } from './modes/config.js';
import { runSimulateMode } from './modes/simulate.js';
import { printBanner } from '../ui.js';

/**
 * Fluxo do `jarvis voz`.
 *
 * Modos:
 *   jarvis voz                                → modo simulação interativo
 *   jarvis voz "frase"                        → simula a frase
 *   jarvis voz "frase" --run                  → simula e executa
 *   jarvis voz --ouvir                        → grava + transcreve + EXECUTA
 *   jarvis voz --ouvir --confirm              → grava + transcreve + pergunta
 *   jarvis voz --wake                         → escuta contínua (executa)
 *   jarvis voz --wake --confirm               → escuta contínua (pergunta)
 *   jarvis voz ajuda                          → lista intents
 *   jarvis voz --listar-microfones            → lista microfones (Windows)
 *   jarvis voz --config                       → configurar caminhos manualmente
 *   jarvis voz --setup [--model <nome>]       → baixa whisper.cpp + modelo
 *   jarvis voz --instalar-startup             → instala wake word no boot (Windows)
 *   jarvis voz --remover-startup              → remove do boot
 *
 * @param {string} [initialText]
 * @param {{
 *   run?: boolean,
 *   listen?: boolean,
 *   listMics?: boolean,
 *   config?: boolean,
 *   setup?: boolean,
 *   wake?: boolean,
 *   confirm?: boolean,
 *   model?: string,
 *   installStartup?: boolean,
 *   removeStartup?: boolean,
 * }} [opts]
 */
export async function runVoice(initialText, opts = {}) {
  printBanner();

  // Startup (instalar / remover) — não depende do resto
  if (opts.installStartup) {
    runInstallStartup();
    return;
  }
  if (opts.removeStartup) {
    runRemoveStartup();
    return;
  }

  // Setup (baixar whisper + modelo)
  if (opts.setup) {
    await runVoiceSetup({ model: opts.model });
    return;
  }

  // Wake word (contínuo)
  if (opts.wake) {
    await runWakeMode({ confirm: opts.confirm });
    return;
  }

  // Listar microfones
  if (opts.listMics) {
    runListMicsMode();
    return;
  }

  // Config manual
  if (opts.config) {
    await runConfigMode();
    return;
  }

  // Push-to-talk (uma captura)
  if (opts.listen) {
    await runListenMode({ confirm: opts.confirm });
    return;
  }

  // Simulação (frase digitada)
  await runSimulateMode(initialText, {
    run: opts.run,
    confirm: opts.confirm,
  });
}