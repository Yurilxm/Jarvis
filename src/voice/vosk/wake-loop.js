import fs from "node:fs";
import path from "node:path";
import { startAudioStream } from "../audioCapture.js";
import { transcribeWithWhisper, DEFAULT_WHISPER_PROMPT } from "../whisper.js";
import { readVoiceConfig } from "../config.js";
import { captureCommandPhrase } from "../capture.js";
import { handleText, printMissingDependencies } from "../handlers.js";
import { playWakeSound } from "../sound.js";
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
const DEFAULT_SESSION_TIMEOUT_MS = 30000;

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
    console.log(`Script nao encontrado: ${deps.script.path}`);
    blank();
  }
}

/**
 * Loop de wake word com Vosk, com suporte a modo sessao:
 *   1. Aguarda "Jarvis" (Vosk)
 *   2. Ao detectar, entra em sessao
 *   3. Em sessao: captura comandos seguidos sem exigir "Jarvis" de novo
 *   4. Sai da sessao apos `sessionTimeoutMs` de silencio
 *   5. Volta ao passo 1
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
    `${chalk.bold("Engine")}       Vosk (local, sem API)\n` +
    `${chalk.bold("Wake word")}    ${cfg.wakeKeyword || "jarvis"}\n` +
    `${chalk.bold("Python")}       ${voskDeps.python.python.label}\n` +
    `${chalk.bold("Modelo")}       ${path.basename(voskDeps.model.path)}\n` +
    `${chalk.bold("whisper")}      ${path.basename(whisperDeps.whisper.path)}\n` +
    `${chalk.bold("Microfone")}    ${whisperDeps.audioDevice || muted("default do sistema")}\n` +
    `${chalk.bold("Sessao")}       ${Math.round(sessionTimeoutMs / 1000)}s apos a wake word`,
    { title: "wake word ativo", borderColor: "green" }
  );
  blank();
  info(`Diga "Jarvis" para ativar. Ctrl+C para sair.`);
  dim(`  Depois de ativado, continua escutando por ${Math.round(sessionTimeoutMs / 1000)}s sem precisar dizer "Jarvis" de novo.`);
  blank();

  let running = true;
  const onSigint = () => {
    running = false;
    dim("\nEncerrando wake word...");
  };
  process.once("SIGINT", onSigint);

  const audio = startAudioStream({
    recorderPath: whisperDeps.recorder.path,
    type: whisperDeps.recorder.type,
    audioDevice: whisperDeps.audioDevice,
  });

  const listener = createVoskListener({
    pythonCmd: voskDeps.python.python.cmd,
    pythonArgs: voskDeps.python.python.args,
    scriptPath: voskDeps.script.path,
    modelPath: voskDeps.model.path,
  });

  let processing = false;
  let wakeDetected = false;

  listener.on("log", () => {
    // Logs do Python — silenciados por padrao.
    // Para ver: JARVIS_VOSK_DEBUG=1 no ambiente.
  });

  listener.on("error", (err) => {
    error(`Erro no listener Vosk: ${err.message}`);
    running = false;
  });

  listener.on("wake", () => {
    wakeDetected = true;
  });

  // Alimenta o Vosk enquanto nao estiver processando um comando
  audio.stream.on("data", (chunk) => {
    if (!running || processing) return;
    listener.write(chunk);
  });

  // Aguarda wake word com polling (evita race condition entre evento e loop)
  async function waitForWake() {
    while (running && !wakeDetected) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const got = wakeDetected;
    wakeDetected = false;
    return got;
  }

  // ─── Loop principal ────────────────────────────────────────────────
  while (running) {
    dim("  (aguardando \"Jarvis\"...)");
    const gotWake = await waitForWake();
    if (!running) break;
    if (!gotWake) continue;

    playWakeSound();
    blank();
    success("Wake word detectada!");
    dim(`  Sessao ativa por ${Math.round(sessionTimeoutMs / 1000)}s. Fale seus comandos sem dizer "Jarvis".`);
    blank();

    let inSession = true;

    // ─── Sessao: captura comandos seguidos ───────────────────────────
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
        error(`Erro ao capturar comando: ${err.message}`);
        processing = false;
        inSession = false;
        break;
      }

      processing = false;
      if (!running) break;

      // Sem voz: encerra a sessao por inatividade
      if (!capture.hadVoice) {
        dim("Sessao encerrada por inatividade.");
        inSession = false;
        break;
      }

      // Transcreve
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
        error(`Erro ao executar comando: ${err.message}`);
      }

      if (running && inSession) {
        blank();
        dim(`  Sessao ativa. Fale o proximo comando (ou aguarde ${Math.round(sessionTimeoutMs / 1000)}s para encerrar).`);
        blank();
      }
    }

    if (running) {
      blank();
      info(`Diga "Jarvis" para ativar de novo.`);
      blank();
    }
  }

  listener.stop();
  audio.stop();
  process.removeListener("SIGINT", onSigint);
  blank();
  info("Wake word encerrado.");
}
