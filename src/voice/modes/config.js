import { input } from '@inquirer/prompts';
import {
  checkVoiceDependencies,
  listAudioDevices,
} from '../dependencies.js';
import {
  updateVoiceConfig,
  readVoiceConfig,
  getVoiceConfigPath,
} from '../config.js';
import {
  info,
  success,
  warn,
  error,
  dim,
  blank,
  section,
  chalk,
} from '../../ui.js';

/**
 * Modo --listar-microfones: lista dispositivos de áudio no Windows.
 */
export function runListMicsMode() {
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
}

/**
 * Modo --config: configuração manual de caminhos e microfone.
 */
export async function runConfigMode() {
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
}