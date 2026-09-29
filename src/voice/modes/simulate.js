import { input } from '@inquirer/prompts';
import { listIntents } from '../intentMatcher.js';
import { handleText } from '../handlers.js';
import {
  info,
  dim,
  blank,
  section,
  chalk,
  muted,
} from '../../ui.js';

/**
 * Modo simulação: recebe uma frase (digitada ou via CLI) e faz o match
 * sem usar microfone. Serve para testar o intent matcher.
 *
 * @param {string} [initialText]
 * @param {{ run?: boolean, confirm?: boolean }} [opts]
 */
export async function runSimulateMode(initialText, opts = {}) {
  info('Jarvis Voz — modo simulação');
  dim('  Para captura real de voz, use: jarvis voz --ouvir');
  dim('  Comandos reconhecidos: use "jarvis voz ajuda".');
  blank();

  // Modo interativo (sem frase inicial)
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

      await handleText(trimmed, {
        execute: opts.run,
        confirm: opts.confirm,
      });
      blank();
    }
  }

  const trimmed = String(initialText).trim();

  // Ajuda
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

  await handleText(trimmed, {
    execute: opts.run,
    confirm: opts.confirm,
  });
}