import fs from "node:fs";
import path from "node:path";
import { startAudioStream } from "../audioCapture.js";
import { transcribeWithWhisper, DEFAULT_WHISPER_PROMPT } from "../whisper.js";
import { readVoiceConfig } from "../config.js";
import { captureCommandPhrase } from "../capture.js";
import { handleText, printMissingDependencies } from "../handlers.js";
import {
  openSessionTerminal,
  closeSessionTerminal,
  cleanupOldSessions,
} from "../ephemeral-terminal.js";
import { playWakeSound, speakTextAwait } from "../sound.js";
import { checkVoiceDependencies } from "../dependencies.js";
import { checkVoskDependencies } from "./dependencies.js";
import { createVoskListener } from "./listener.js";
import {
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  spinner,
  chalk,
  muted,
} from "../../ui.js";

const SAMPLE_RATE = 16000;
const GREETING_TAIL_MS = 400;

/**
 * Aguarda um pequeno delay consumindo os chunks do stream. Usado depois do
 * greeting pra descartar qualquer audio residual (do proprio TTS ou do
 * ambiente) antes da captura do comando comecar.
 *
 * @param {import('node:stream').Readable} stream
 * @param {number} ms
 * @returns {Promise<void>}
 */
function drainAudioStream(stream, ms) {
  return new Promise((resolve) => {
    if (!stream) return resolve();
    const noop = () => {};
    stream.on('data', noop);
    setTimeout(() => {
      stream.off('data', noop);
      resolve();
    }, ms).unref();
  });
}
const DEFAULT_SESSION_TIMEOUT_MS = 30000;
const MAX_LISTENER_RESTARTS = 3;
const RESTART_BACKOFF_MS = 2000;

/**
 * Mostra o que falta para usar o modo --wake (Vosk).
 * @param {object} deps - resultado de checkVoskDependencies()
 */
export function printMissingVoskDependencies(deps) {
  blank();
  warn("Wake word (Vosk) nao esta pronto neste ambiente.");
  blank();

  if (!deps.python.ok) {
    console.log(deps.python.reason);
    blank();
  }
  if (!deps.model.ok) {
    console.log(deps.model.reason);
    blank();
  }
  if (!deps.script.ok) {
    console.log("Script nao encontrado: " + deps.script.path);
    blank();
  }
}

/**
 * Loop de wake word com Vosk, com modo sessao e auto-restart do listener.
 *
 * @param {{ confirm?: boolean }} [opts]
 */
export async function runVoskWakeLoop(opts = {}) {
  const cfg = readVoiceConfig();

  const voskDeps = checkVoskDependencies(cfg);
  if (!voskDeps.ok) {
    printMissingVoskDependencies(voskDeps);
    return;
  }

  const whisperDeps = checkVoiceDependencies();
  if (!whisperDeps.ok) {
    printMissingDependencies(whisperDeps);
    return;
  }

  const sessionTimeoutMs = cfg.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS;

  printBox(
    chalk.bold("Engine") + "       Vosk (local, sem API)\n" +
    chalk.bold("Wake word") + "    " + (cfg.wakeKeyword || "jarvis") + "\n" +
    chalk.bold("Python") + "       " + voskDeps.python.python.label + "\n" +
    chalk.bold("Modelo") + "       " + path.basename(voskDeps.model.path) + "\n" +
    chalk.bold("whisper") + "      " + path.basename(whisperDeps.whisper.path) + "\n" +
    chalk.bold("Microfone") + "    " + (whisperDeps.audioDevice || muted("default do sistema")) + "\n" +
    chalk.bold("Sessao") + "       " + Math.round(sessionTimeoutMs / 1000) + "s apos a wake word",
    { title: "wake word ativo", borderColor: "green" }
  );
  blank();
  info('Diga "Jarvis" para ativar. Ctrl+C para sair.');
  dim("  Depois de ativado, continua escutando por " + Math.round(sessionTimeoutMs / 1000) + "s sem precisar dizer \"Jarvis\" de novo.");
  blank();

  // Limpa sessoes antigas (logs de execucoes anteriores)
  cleanupOldSessions();

  let running = true;
  const onSigint = () => {
    running = false;
    dim("\nEncerrando wake word...");
  };
  process.once("SIGINT", onSigint);

  // ─── Estado mutavel ───────────────────────────────────────────────
  let audio = null;
  let listener = null;
  let wakeDetected = false;
  let processing = false;
  let audioClosed = false;
  let listenerRestarts = 0;
  let onAudioData = null;

  // ─── Factory do listener (permite restart) ────────────────────────
  function createListener() {
    const l = createVoskListener({
      pythonCmd: voskDeps.python.python.cmd,
      pythonArgs: voskDeps.python.python.args,
      scriptPath: voskDeps.script.path,
      modelPath: voskDeps.model.path,
    });

    l.on("log", () => {
      // Logs silenciados. Use JARVIS_VOSK_DEBUG=1 pra ver.
    });

    l.on("error", (err) => {
      error("Erro no listener Vosk: " + err.message);
    });

    l.on("wake", () => {
      wakeDetected = true;
    });

    l.on("close", () => {
      // Se fechou por vontade propria (stop), ignora.
      if (!running) return;

      // Senao, tenta reconectar
      if (listenerRestarts < MAX_LISTENER_RESTARTS) {
        listenerRestarts++;
        const delay = RESTART_BACKOFF_MS * listenerRestarts;
        warn("Listener Vosk caiu. Reconectando em " + Math.round(delay / 1000) + "s... (" + listenerRestarts + "/" + MAX_LISTENER_RESTARTS + ")");
        setTimeout(() => {
          if (!running) return;
          try {
            listener = createListener();
            // Reanexa o forwarding de audio
            if (audio && audio.stream && onAudioData) {
              audio.stream.on("data", onAudioData);
            }
          } catch (err) {
            error("Falha ao reconectar listener: " + err.message);
            running = false;
          }
        }, delay).unref();
      } else {
        error("Listener Vosk caiu " + MAX_LISTENER_RESTARTS + " vezes seguidas. Encerrando.");
        running = false;
      }
    });

    return l;
  }

  // ─── Audio ────────────────────────────────────────────────────────
  try {
    audio = startAudioStream({
      recorderPath: whisperDeps.recorder.path,
      type: whisperDeps.recorder.type,
      audioDevice: whisperDeps.audioDevice,
    });
  } catch (err) {
    error("Falha ao abrir microfone: " + err.message);
    process.removeListener("SIGINT", onSigint);
    return;
  }

  audio.child.on("close", () => {
    if (!running) return;
    audioClosed = true;
    warn("Microfone desconectado (ffmpeg encerrou).");
    dim("  Encerrando o loop de voz.");
    running = false;
  });

  listener = createListener();

  // Forwarding de audio -> listener (com checagem de processamento)
  onAudioData = (chunk) => {
    if (!running || processing) return;
    if (!listener) return;
    listener.write(chunk);
  };
  audio.stream.on("data", onAudioData);

  // ─── Aguarda wake com polling ─────────────────────────────────────
  async function waitForWake() {
    while (running && !wakeDetected) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const got = wakeDetected;
    wakeDetected = false;
    return got;
  }

  // ─── Loop principal ───────────────────────────────────────────────
  while (running) {
    dim('  (aguardando "Jarvis"...)');
    const gotWake = await waitForWake();
    if (!running) break;
    if (!gotWake) continue;

    const shouldGreet = cfg.greetOnWake !== false;
    const greeting = cfg.wakeGreeting || "Oi Yuri, pode falar";

    if (shouldGreet && greeting) {
      processing = true;
      try {
        await speakTextAwait(greeting);
        await drainAudioStream(audio.stream, GREETING_TAIL_MS);
      } catch {
        // silencioso
      } finally {
        processing = false;
        wakeDetected = false;
      }
    } else {
      playWakeSound();
    }

    // Abre janela minimizada persistente da sessao (se configurado)
    if (cfg.voiceOutputMode === "session-window") {
      const opened = openSessionTerminal();
      if (!opened.ok) {
        dim("  (nao foi possivel abrir a janela da sessao: " + (opened.reason || "erro") + ")");
      }
    }

    blank();
    success("Wake word detectada!");
    dim("  Sessao ativa por " + Math.round(sessionTimeoutMs / 1000) + "s. Fale seus comandos sem dizer \"Jarvis\".");
    blank();

    let inSession = true;

    while (running && inSession) {
      processing = true;

      let capture;
      try {
        capture = await captureCommandPhrase(audio.stream, SAMPLE_RATE, {
          maxDurationMs: sessionTimeoutMs,
          silenceMs: cfg.commandSilenceMs ?? 1500,
          minVoiceMs: 300,
        });
      } catch (err) {
        error("Erro ao capturar comando: " + err.message);
        processing = false;
        inSession = false;
        break;
      }

      processing = false;
      if (!running) break;

      if (!capture.hadVoice) {
        dim("Sessao encerrada por inatividade.");
        inSession = false;

        const farewell = cfg.wakeFarewell || "Estou aqui se precisar";
        if (shouldGreet && farewell) {
          processing = true;
          try {
            await speakTextAwait(farewell);
          } catch {
            // silencioso
          } finally {
            processing = false;
          }
        }

        // Fecha a janela efemera da sessao
        if (cfg.voiceOutputMode === "session-window") {
          closeSessionTerminal();
        }

        break;
      }

      const transSpin = spinner("Transcrevendo...");
      transSpin.start();

      let text = "";
      try {
        const res = await transcribeWithWhisper(capture.path, {
          whisperPath: whisperDeps.whisper.path,
          modelPath: whisperDeps.model.path,
          language: cfg.language || "pt",
          prompt: cfg.whisperPrompt || DEFAULT_WHISPER_PROMPT,
          threads: cfg.whisperThreads || 4,
        });
        text = res.text;
        transSpin.succeed("Transcricao concluida.");
      } catch (err) {
        transSpin.fail("Erro na transcricao");
        error(err.message);
        try { fs.unlinkSync(capture.path); } catch { /* ignore */ }
        blank();
        continue;
      }

      try { fs.unlinkSync(capture.path); } catch { /* ignore */ }

      if (!text) {
        warn("Nenhuma fala detectada.");
        blank();
        continue;
      }

      blank();
      printBox(text, { title: "voce disse", borderColor: "cyan" });
      blank();

      try {
        await handleText(text, {
          execute: !opts.confirm,
          confirm: opts.confirm,
        });
      } catch (err) {
        error("Erro ao executar comando: " + err.message);
      }

      if (running && inSession) {
        blank();
        dim("  Sessao ativa. Fale o proximo comando (ou aguarde " + Math.round(sessionTimeoutMs / 1000) + "s para encerrar).");
        blank();
      }
    }

    if (running) {
      blank();
      info('Diga "Jarvis" para ativar de novo.');
      blank();
    }
  }

  if (listener) {
    try { listener.stop(); } catch { /* ignore */ }
  }
  if (audio) {
    try { audio.stop(); } catch { /* ignore */ }
  }
  process.removeListener("SIGINT", onSigint);

  if (!audioClosed && cfg.greetOnWake !== false) {
    const farewell = cfg.wakeFarewell || "Estou aqui se precisar";
    if (farewell) {
      try {
        await speakTextAwait(farewell);
      } catch {
        // silencioso
      }
    }
  }

  // Fecha a janela efemera da sessao
  if (cfg.voiceOutputMode === "session-window") {
    closeSessionTerminal();
  }

  blank();
  if (audioClosed) {
    warn("Wake word encerrado (microfone desconectado).");
  } else {
    info("Wake word encerrado.");
  }
}
