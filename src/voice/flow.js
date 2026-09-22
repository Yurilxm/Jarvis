import { input, confirm } from '@inquirer/prompts';
import { matchIntent, listIntents } from './intentMatcher.js';
import { dispatchIntent } from './dispatch.js';
import {
  checkVoiceDependencies,
  listAudioDevices,
} from './dependencies.js';
import { startRecording } from './audioCapture.js';
import { transcribeWithWhisper } from './whisper.js';
import {
  updateVoiceConfig,
  readVoiceConfig,
  getVoiceConfigPath,
} from './config.js';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  section,
  spinner,
  chalk,
  muted,
} from '../ui.js';
import { runVoiceSetup } from './setup.js';
import { startAudioStream } from './audioCapture.js';
import { createWakeWordDetector, frameSplitter } from './wakeword.js';
import { writeWavFile, rmsLevel } from './wav.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

function confidenceLabel(confidence) {
  switch (confidence) {
    case 'high': return chalk.green('alta');
    case 'medium': return chalk.yellow('média');
    case 'low': return muted('baixa');
    default: return muted('—');
  }
}

/**
 * Processa um texto: faz o match, mostra o resultado e (se solicitado)
 * executa o comando.
 *
 * @param {string} text
 * @param {{ run?: boolean, interactive?: boolean }} [opts]
 */
async function handleText(text, opts = {}) {
  const result = matchIntent(text);

  if (!result.intent) {
    warn('Nenhum comando reconhecido.');
    blank();
    dim('Tente frases como:');
    dim('  · "o que eu tenho hoje"');
    dim('  · "lista do jira"');
    dim('  · "status do projeto"');
    dim('  · "relatório da task SDG-71"');
    blank();
    return;
  }

  const argvStr = result.argv.join(' ');

  printBox(
    `${chalk.bold('Intent')}       ${result.intent}\n` +
    `${chalk.bold('Comando')}      jarvis ${argvStr}\n` +
    `${chalk.bold('Confiança')}    ${confidenceLabel(result.confidence)}` +
      (result.matchedBy ? ` ${muted('(' + result.matchedBy + ')')}` : '') + `\n` +
    `${chalk.bold('Descrição')}    ${result.description || '-'}`,
    { title: 'reconhecimento', borderColor: 'green' }
  );
  blank();

  if (opts.run) {
    info(`Executando: jarvis ${argvStr}`);
    blank();
    try {
      const ok = await dispatchIntent(result.argv);
      if (ok === 'help') {
        const { printCatalogBoxes } = await import('../commands/menu.js');
        printCatalogBoxes();
      } else if (!ok) {
        warn(`Comando '${argvStr}' ainda não é suportado no modo voz.`);
        dim('  (os comandos suportados nesta fase estão listados no topo do dispatch.js)');
      }
    } catch (err) {
      error(`Erro ao executar: ${err.message}`);
    }
    return;
  }

  if (opts.interactive) {
    const shouldRun = await confirm({
      message: 'Executar este comando?',
      default: false,
    });

    if (!shouldRun) {
      dim('Não executado.');
      return;
    }

    blank();
    info(`Executando: jarvis ${argvStr}`);
    blank();
    try {
      const ok = await dispatchIntent(result.argv);
      if (ok === 'help') {
        const { printCatalogBoxes } = await import('../commands/menu.js');
        printCatalogBoxes();
      } else if (!ok) {
        warn(`Comando '${argvStr}' ainda não é suportado no modo voz.`);
      }
    } catch (err) {
      error(`Erro ao executar: ${err.message}`);
    }
    return;
  }

  dim('  (modo simulação — use --run para executar o comando de verdade)');
}

/**
 * Mostra o que falta para usar o modo --ouvir.
 */
function printMissingDependencies(deps) {
  blank();
  warn('Captura de voz não está pronta neste ambiente.');
  blank();

  if (!deps.recorder.ok) {
    section('Gravador de áudio');
    console.log(deps.recorder.reason);
    blank();
  }

  if (!deps.whisper.ok) {
    section('whisper.cpp');
    console.log(deps.whisper.reason);
    blank();
  }

  if (!deps.model.ok) {
    section('Modelo do whisper');
    console.log(deps.model.reason);
    blank();
  }

  if (deps.recorder.ok && !deps.audioDevice && process.platform === 'win32') {
    section('Dispositivo de áudio (Windows)');
    console.log(
      'Nenhum microfone foi detectado automaticamente.\n' +
      '  Rode: jarvis voz --listar-microfones'
    );
    blank();
  }

  dim(`Config: ${getVoiceConfigPath()}`);
  blank();
}

/**
 * Grava uma "frase de comando" após a wake word ser detectada.
 * Para quando:
 *  - passou `maxDurationMs` (padrão 8s), ou
 *  - detectou silêncio por `silenceMs` (padrão 1.5s) após ter havido som.
 *
 * @param {NodeJS.ReadableStream} stream
 * @param {number} sampleRate
 * @param {{ maxDurationMs?: number, silenceMs?: number, minVoiceMs?: number }} [opts]
 * @returns {Promise<string>} caminho do WAV salvo
 */
function captureCommandPhrase(stream, sampleRate, opts = {}) {
  const maxDurationMs = opts.maxDurationMs ?? 8000;
  const silenceMs = opts.silenceMs ?? 1500;
  const minVoiceMs = opts.minVoiceMs ?? 300;

  return new Promise((resolve, reject) => {
    const chunks = [];
    const start = Date.now();
    let lastVoiceAt = null;
    let totalVoiceMs = 0;

    const frameMs = 100; // janela RMS
    const bytesPerWindow = Math.floor(sampleRate * 2 * (frameMs / 1000));
    let carry = Buffer.alloc(0);

    const cleanup = () => {
      stream.removeListener('data', onData);
      stream.removeListener('error', onError);
    };

    const finish = () => {
      cleanup();
      const pcm = Buffer.concat(chunks);
      const outPath = path.join(os.tmpdir(), 'jarvis-voz', `cmd-${Date.now()}.wav`);
      if (!fs.existsSync(path.dirname(outPath))) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
      }
      writeWavFile(outPath, pcm, { sampleRate });
      resolve(outPath);
    };

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    const onData = (chunk) => {
      chunks.push(chunk);
      carry = Buffer.concat([carry, chunk]);

      while (carry.length >= bytesPerWindow) {
        const win = carry.subarray(0, bytesPerWindow);
        carry = carry.subarray(bytesPerWindow);

        const level = rmsLevel(win);
        const now = Date.now();

        if (level > 0.02) {
          lastVoiceAt = now;
          totalVoiceMs += frameMs;
        }

        const elapsed = now - start;
        const silentFor = lastVoiceAt ? now - lastVoiceAt : 0;

        if (totalVoiceMs >= minVoiceMs && silentFor >= silenceMs) {
          finish();
          return;
        }
        if (elapsed >= maxDurationMs) {
          finish();
          return;
        }
      }
    };

    stream.on('data', onData);
    stream.on('error', onError);
  });
}

/**
 * Modo --wake: escuta continuamente, aguarda a wake word e então grava
 * uma frase, transcreve e roteia.
 */
async function runWakeMode(opts = {}) {
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
        // ignora frames com erro (não deveria acontecer)
      }

      if (keywordIndex >= 0) {
        processing = true;
        blank();
        success(`🎙️  Wake word detectada!`);
        dim('  Fale agora...');

        try {
          // Pausa processamento; deixa o stream seguir alimentando o buffer
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

          await handleText(text, { run: opts.run ?? true, interactive: !opts.run });
        } catch (err) {
          error(`Erro ao capturar comando: ${err.message}`);
        }

        processing = false;
        info(`Diga "${cfg.wakeKeyword || 'JARVIS'}" para ativar de novo.`);
      }
    }
  });

  // Espera até SIGINT ou até o processo morrer
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

/**
 * Modo --ouvir: push-to-talk.
 */
async function runListenMode(opts = {}) {
  const deps = checkVoiceDependencies();

  if (!deps.ok) {
    printMissingDependencies(deps);
    return;
  }

  printBox(
    `${chalk.bold('Gravador')}    ${deps.recorder.type} (${deps.recorder.path})\n` +
    `${chalk.bold('whisper')}     ${deps.whisper.path}\n` +
    `${chalk.bold('Modelo')}      ${require('node:path').basename(deps.model.path)}\n` +
    `${chalk.bold('Microfone')}   ${deps.audioDevice || muted('default do sistema')}`,
    { title: 'captura de voz', borderColor: 'green' }
  );
  blank();

  info('Pressione Enter para começar a gravar.');
  await input({ message: 'Pronto?' });

  const recordSpinner = spinner('Gravando... pressione Enter para parar.');
  recordSpinner.start();

  let recording;
  try {
    recording = startRecording({
      recorderPath: deps.recorder.path,
      type: deps.recorder.type,
      audioDevice: deps.audioDevice,
      maxDurationMs: 30000,
    });
  } catch (err) {
    recordSpinner.fail('Falha ao iniciar gravação');
    error(err.message);
    return;
  }

  // Espera o usuário apertar Enter (ou timeout de 30s)
  await input({ message: '' }).catch(() => { /* Ctrl+C */ });
  recording.stop('manual');

  let audioPath;
  try {
    const res = await recording;
    audioPath = res.outputPath;
    if (res.reason === 'timeout') {
      recordSpinner.succeed('Gravação encerrada (limite de 30s).');
    } else {
      recordSpinner.succeed('Gravação encerrada.');
    }
  } catch (err) {
    recordSpinner.fail('Erro na gravação');
    error(err.message);
    return;
  }

  // Transcreve
  const transSpin = spinner('Transcrevendo com whisper.cpp...');
  transSpin.start();

  let transcription;
  try {
    const res = await transcribeWithWhisper(audioPath, {
      whisperPath: deps.whisper.path,
      modelPath: deps.model.path,
      language: readVoiceConfig().language || 'pt',
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
    run: opts.run,
    interactive: !opts.run,
  });
}

/**
 * Fluxo do `jarvis voz`.
 *
 * Modos:
 *   jarvis voz                                → modo simulação interativo
 *   jarvis voz "frase"                        → simula a frase
 *   jarvis voz "frase" --run                  → simula e executa
 *   jarvis voz --ouvir                        → grava + transcreve + sugere
 *   jarvis voz --ouvir --run                  → grava + transcreve + executa
 *   jarvis voz ajuda                          → lista intents
 *   jarvis voz --listar-microfones            → lista microfones (Windows)
 *   jarvis voz --config                       → configurar caminhos manualmente
 *
 * @param {string} [initialText]
 * @param {{ run?: boolean, listen?: boolean, listMics?: boolean, config?: boolean }} [opts]
 */
export async function runVoice(initialText, opts = {}) {
  printBanner();

  if (opts.setup) {
    await runVoiceSetup({ model: opts.model });
    return;
  }

  if (opts.wake) {
    await runWakeMode({ run: opts.run });
    return;
  }

  // --listar-microfones
  if (opts.listMics) {
    const deps = checkVoiceDependencies();
    if (!deps.recorder.ok) {
      error(deps.recorder.reason);
      return;
    }
    if (deps.recorder.type !== 'ffmpeg') {
      warn('Listagem de microfones só está disponível com ffmpeg (Windows).');
      return;
    }
    const devices = listAudioDevices(deps.recorder.path);
    if (!devices || devices.length === 0) {
      warn('Nenhum microfone detectado.');
      return;
    }
    section('Microfones disponíveis');
    devices.forEach((d, i) => console.log(`  ${chalk.green(i + 1)}. ${d}`));
    blank();
    info(`Use o nome exato no arquivo de config: ${getVoiceConfigPath()}`);
    return;
  }

  // --config
  if (opts.config) {
    const cfg = readVoiceConfig();
    blank();
    info('Configuração manual do Jarvis Voz');
    dim(`  Arquivo: ${getVoiceConfigPath()}`);
    blank();

    const recorderPath = await input({
      message: 'Caminho do ffmpeg (ou sox):',
      default: cfg.recorderPath || '',
    });
    const whisperPath = await input({
      message: 'Caminho do whisper.cpp (main.exe/whisper-cli):',
      default: cfg.whisperPath || '',
    });
    const modelPath = await input({
      message: 'Caminho do modelo (.bin):',
      default: cfg.modelPath || '',
    });
    const audioDevice = await input({
      message: 'Nome do microfone (Windows — deixe vazio para default):',
      default: cfg.audioDevice || '',
    });
    const language = await input({
      message: 'Idioma (pt, en, es...):',
      default: cfg.language || 'pt',
    });

    updateVoiceConfig({
      recorderPath: recorderPath.trim() || undefined,
      whisperPath: whisperPath.trim() || undefined,
      modelPath: modelPath.trim() || undefined,
      audioDevice: audioDevice.trim() || undefined,
      language: language.trim() || 'pt',
    });

    success('Config salva.');
    return;
  }

  // --ouvir
  if (opts.listen) {
    await runListenMode({ run: opts.run });
    return;
  }

  // Modo simulação (fase 3a)
  info('Jarvis Voz — modo simulação (fase 3a)');
  dim('  Para captura real de voz, use: jarvis voz --ouvir');
  dim('  Comandos reconhecidos: use "jarvis voz ajuda".');
  blank();

  if (!initialText) {
    while (true) {
      let text;
      try {
        text = await input({
          message: 'Digite uma frase (ou "sair" para encerrar):',
        });
      } catch {
        info('Encerrando.');
        return;
      }

      const trimmed = String(text || '').trim();

      if (!trimmed || trimmed.toLowerCase() === 'sair') {
        info('Encerrando.');
        return;
      }

      await handleText(trimmed, { ...opts, interactive: true });
      blank();
    }
  }

  const trimmed = String(initialText).trim();
  if (trimmed.toLowerCase() === 'ajuda' || trimmed.toLowerCase() === 'help') {
    section('Frases de exemplo reconhecidas');
    const intents = listIntents();
    for (const i of intents) {
      const args = i.needsArg ? ' <chave>' : '';
      const cmd = `jarvis ${i.argv.join(' ')}${args}`;
      console.log(`  ${chalk.green(cmd.padEnd(36))} ${muted(i.description)}`);
    }
    blank();
    dim('Dica: para executar, use  jarvis voz "frase" --run');
    dim('      para gravar de verdade, use  jarvis voz --ouvir');
    return;
  }

  await handleText(trimmed, opts);
}