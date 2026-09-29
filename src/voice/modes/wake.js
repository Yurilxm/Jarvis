import fs from 'node:fs';
import path from 'node:path';
import { startAudioStream } from '../audioCapture.js';
import { transcribeWithWhisper, DEFAULT_WHISPER_PROMPT } from '../whisper.js';
import { readVoiceConfig } from '../config.js';
import { captureCommandPhrase } from '../capture.js';
import { handleText, printMissingDependencies } from '../handlers.js';
import { playWakeSound } from '../sound.js';
import {
  checkVoiceDependencies,
} from '../dependencies.js';
import {
  createWakeWordDetector,
  frameSplitter,
} from '../_legacy/wakeword.js';
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
} from '../../ui.js';

/**
 * Modo --wake: escuta continuamente, aguarda a wake word e então grava
 * uma frase, transcreve e executa.
 *
 * ⚠️ EXPERIMENTAL — usa o SDK do Porcupine (Picovoice), que exige uma
 * AccessKey. O free tier foi fechado pela Picovoice, então este modo só
 * funciona com conta paga. Será substituído por Vosk em etapa futura.
 * Ver `src/voice/wakeword.js` para detalhes.
 *
 * @param {{ confirm?: boolean }} [opts]
 */
export async function runWakeMode(opts = {}) {
  const deps = checkVoiceDependencies();
  if (!deps.ok) {
    printMissingDependencies(deps);
    return;
  }

  const wake = await createWakeWordDetector();
  if (!wake.ok) {
    blank();
    warn('Wake word indisponível.');
    console.log(wake.reason);
    blank();
    return;
  }

  const cfg = readVoiceConfig();

  printBox(
    `${chalk.bold('Wake word')}   ${cfg.wakeKeyword || 'JARVIS'}\n` +
    `${chalk.bold('Gravador')}    ${deps.recorder.type} (${deps.recorder.path})\n` +
    `${chalk.bold('whisper')}     ${deps.whisper.path}\n` +
    `${chalk.bold('Modelo')}      ${path.basename(deps.model.path)}\n` +
    `${chalk.bold('Microfone')}   ${deps.audioDevice || muted('default do sistema')}`,
    { title: 'wake word ativo', borderColor: 'green' }
  );
  blank();
  info(`Diga "${cfg.wakeKeyword || 'JARVIS'}" para ativar. Ctrl+C para sair.`);
  blank();

  let running = true;
  const onSigint = () => {
    running = false;
    dim('\nEncerrando wake word...');
  };
  process.once('SIGINT', onSigint);

  const { child, stream, stop } = startAudioStream({
    recorderPath: deps.recorder.path,
    type: deps.recorder.type,
    audioDevice: deps.audioDevice,
  });

  const splitter = frameSplitter(wake.frameLength);
  let processing = false;

  stream.on('data', async (chunk) => {
    if (!running || processing) return;

    const frames = splitter.push(chunk);
    for (const frame of frames) {
      if (processing || !running) break;

      let keywordIndex = -1;
      try {
        keywordIndex = wake.handle.process(frame);
      } catch {
        // ignora frames com erro
      }

      if (keywordIndex >= 0) {
        processing = true;
        playWakeSound(); // feedback sonoro (assíncrono)
        blank();
        success(`🎙️  Wake word detectada!`);
        dim('  Fale agora...');

        try {
          const wavPath = await captureCommandPhrase(stream, wake.sampleRate, {
            maxDurationMs: cfg.commandMaxMs ?? 8000,
            silenceMs: cfg.commandSilenceMs ?? 1500,
            minVoiceMs: 300,
          });

          const transSpin = spinner('Transcrevendo...');
          transSpin.start();

          let text = '';
          try {
            const res = await transcribeWithWhisper(wavPath, {
              whisperPath: deps.whisper.path,
              modelPath: deps.model.path,
              language: cfg.language || 'pt',
              prompt: cfg.whisperPrompt || DEFAULT_WHISPER_PROMPT,
              threads: cfg.whisperThreads || 4,
            });
            text = res.text;
            transSpin.succeed('Transcrição concluída.');
          } catch (err) {
            transSpin.fail('Erro na transcrição');
            error(err.message);
            processing = false;
            continue;
          }

          if (!text) {
            warn('Nenhuma fala foi detectada.');
            processing = false;
            continue;
          }

          blank();
          printBox(text, { title: 'você disse', borderColor: 'cyan' });
          blank();

          try {
            fs.unlinkSync(wavPath);
          } catch { /* ignore */ }

          await handleText(text, {
            execute: !opts.confirm,
            confirm: opts.confirm,
          });
        } catch (err) {
          error(`Erro ao capturar comando: ${err.message}`);
        }

        processing = false;
        info(`Diga "${cfg.wakeKeyword || 'JARVIS'}" para ativar de novo.`);
      }
    }
  });

  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (!running) {
        clearInterval(check);
        resolve();
      }
    }, 200);
    child.on('close', () => {
      clearInterval(check);
      resolve();
    });
  });

  stop();
  wake.release();
  process.removeListener('SIGINT', onSigint);
  blank();
  info('Wake word encerrado.');
}