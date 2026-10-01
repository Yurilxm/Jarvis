import { input } from '@inquirer/prompts';
import path from 'node:path';
import {
  checkVoiceDependencies,
} from '../dependencies.js';
import { startAudioStream } from '../audioCapture.js';
import { transcribeWithWhisper, DEFAULT_WHISPER_PROMPT } from '../whisper.js';
import { readVoiceConfig } from '../config.js';
import { captureCommandPhrase } from '../capture.js';
import {
  handleText,
  printMissingDependencies,
} from '../handlers.js';
import {
  printBox,
  info,
  warn,
  error,
  dim,
  blank,
  spinner,
  chalk,
  muted,
} from '../../ui.js';

/**
 * Modo --ouvir: push-to-talk com auto-stop por silêncio.
 * @param {{ confirm?: boolean }} [opts]
 */
export async function runListenMode(opts = {}) {
  const deps = checkVoiceDependencies();

  if (!deps.ok) {
    printMissingDependencies(deps);
    return;
  }

  printBox(
    `${chalk.bold('Gravador')}    ${deps.recorder.type} (${deps.recorder.path})\n` +
    `${chalk.bold('whisper')}     ${deps.whisper.path}\n` +
    `${chalk.bold('Modelo')}      ${path.basename(deps.model.path)}\n` +
    `${chalk.bold('Microfone')}   ${deps.audioDevice || muted('default do sistema')}\n` +
    `${chalk.bold('Modo')}        ${chalk.green('auto-stop por silêncio (~1.2s)')}`,
    { title: 'captura de voz', borderColor: 'green' }
  );
  blank();

  info('Pressione Enter para começar a gravar. Fale e ele para sozinho.');
  await input({ message: 'Pronto?' });
  blank();

  const recordSpinner = spinner('Ouvindo... fale agora.');
  recordSpinner.start();

  let capture;
  let streamControl;
  try {
    streamControl = startAudioStream({
      recorderPath: deps.recorder.path,
      type: deps.recorder.type,
      audioDevice: deps.audioDevice,
    });

    capture = await captureCommandPhrase(streamControl.stream, 16000, {
      maxDurationMs: readVoiceConfig().commandMaxMs ?? 8000,
      silenceMs: readVoiceConfig().commandSilenceMs ?? 1200,
      minVoiceMs: 300,
    });

    try { streamControl.stop(); } catch { /* ignore */ }

    recordSpinner.succeed('Gravação encerrada.');
  } catch (err) {
    recordSpinner.fail('Erro na gravação');
    error(err.message);
    return;
  }

  if (!capture.hadVoice) {
    warn('Nenhuma fala foi detectada no áudio.');
    return;
  }

  const wavPath = capture.path;

  const transSpin = spinner('Transcrevendo com whisper.cpp...');
  transSpin.start();

  let transcription;
  try {
    const res = await transcribeWithWhisper(wavPath, {
      whisperPath: deps.whisper.path,
      modelPath: deps.model.path,
      language: readVoiceConfig().language || 'pt',
      prompt: readVoiceConfig().whisperPrompt || DEFAULT_WHISPER_PROMPT,
      threads: readVoiceConfig().whisperThreads || 4,
    });
    transcription = res.text;
    transSpin.succeed('Transcrição concluída.');
  } catch (err) {
    transSpin.fail('Erro na transcrição');
    error(err.message);
    return;
  }

  if (!transcription) {
    warn('Nenhuma fala foi detectada no áudio.');
    return;
  }

  blank();
  printBox(transcription, { title: 'você disse', borderColor: 'cyan' });
  blank();

  await handleText(transcription, {
    execute: !opts.confirm,
    confirm: opts.confirm,
  });
}