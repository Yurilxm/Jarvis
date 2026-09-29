import { confirm } from '@inquirer/prompts';
import { matchIntent } from './intentMatcher.js';
import { dispatchIntent } from './dispatch.js';
import { getVoiceConfigPath } from './config.js';
import {
  printBox,
  info,
  warn,
  error,
  dim,
  blank,
  section,
  chalk,
  muted,
} from '../ui.js';

/**
 * Rótulo colorido para o nível de confiança do match.
 * @param {string} confidence
 * @returns {string}
 */
export function confidenceLabel(confidence) {
  switch (confidence) {
    case 'high': return chalk.green('alta');
    case 'medium': return chalk.yellow('média');
    case 'low': return muted('baixa');
    default: return muted('—');
  }
}

/**
 * Executa o comando casado pelo intent matcher.
 * @param {{ argv: string[] }} result
 */
export async function executeIntent(result) {
  const argvStr = result.argv.join(' ');
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
      dim('  (os comandos suportados estão listados no topo do dispatch.js)');
    }
  } catch (err) {
    error(`Erro ao executar: ${err.message}`);
  }
}

/**
 * Mostra o resultado do match e executa (padrão) ou pergunta (--confirm).
 *
 * @param {string} text
 * @param {{ run?: boolean, execute?: boolean, confirm?: boolean }} [opts]
 */
export async function handleText(text, opts = {}) {
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

  // Padrão: executa. --confirm: pergunta.
  if (opts.confirm) {
    const shouldRun = await confirm({
      message: 'Executar este comando?',
      default: true,
    });

    if (!shouldRun) {
      dim('Não executado.');
      return;
    }
  } else if (!opts.execute) {
    // Modo simulação pura (sem --run, sem --ouvir, sem --wake)
    dim('  (modo simulação — use --run para executar o comando de verdade)');
    return;
  }

  await executeIntent(result);
}

/**
 * Mostra o que falta para usar o modo --ouvir / --wake.
 * @param {object} deps - resultado de checkVoiceDependencies()
 */
export function printMissingDependencies(deps) {
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