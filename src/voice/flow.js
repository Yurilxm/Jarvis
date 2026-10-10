import { runVoiceSetup, runInstallStartup, runRemoveStartup } from './setup.js';
import { runListenMode } from './modes/listen.js';
import { runWakeMode } from './modes/wake.js';
import { runConfigMode, runListMicsMode } from './modes/config.js';
import { runSimulateMode } from './modes/simulate.js';
import { printBanner, printBox, success, info, error, dim, chalk } from '../ui.js';
import { pauseVoice, resumeVoice, readVoiceState, parseDuration, formatRemaining } from './state.js';

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

  // Pausa / retomada / status do listener
  if (opts.voicePause !== undefined) {
    const raw = opts.voicePause;
    let until = null;
    if (raw && raw !== true) {
      const ms = parseDuration(raw);
      if (!ms) {
        error("Duracao invalida: " + raw + ". Use 30m, 2h, 45s ou 3d.");
        return;
      }
      until = Date.now() + ms;
    }
    const res = pauseVoice({ until });
    if (!res.ok) {
      error("Falha ao pausar: " + res.reason);
      return;
    }
    const txt = until ? "por " + formatRemaining(until) : "indefinidamente";
    success("Jarvis Voz pausado " + txt + ".");
    dim("  Para retomar: jarvis voz --voltar");
    return;
  }

  if (opts.voiceResume) {
    const res = resumeVoice();
    if (res.wasPaused) {
      success("Jarvis Voz retomado.");
    } else {
      info("Jarvis Voz nao estava pausado.");
    }
    return;
  }

  if (opts.voiceStatus) {
    const st = readVoiceState();
    if (!st.paused) {
      printBox(chalk.bold("Estado") + "     " + chalk.green("ativo"), { title: "jarvis voz", borderColor: "green" });
    } else {
      const remaining = st.until ? formatRemaining(st.until) : "indefinido";
      printBox(
        chalk.bold("Estado") + "     " + chalk.yellow("pausado") + "\n" +
        chalk.bold("Restante") + "   " + remaining + "\n" +
        chalk.bold("Pausado em") + " " + (st.pausedAt ? new Date(st.pausedAt).toLocaleString("pt-BR") : "-"),
        { title: "jarvis voz", borderColor: "yellow" }
      );
    }
    return;
  }

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
    await runVoiceSetup({
      model: opts.model,
      engine: opts.engine,
      voskModel: opts.voskModel,
    });
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