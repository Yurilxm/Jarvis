import { isGitRepo } from '../git/status.js';
import { hasUncommittedChanges } from '../git/branch.js';
import { confirm } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  showLoading,
  chalk,
} from '../ui.js';

export async function runUpdate() {
  printBanner();
  info('Atualizando o Jarvis...');

  if (isGitRepo()) {
    if (hasUncommittedChanges()) {
      warn('Existem alterações não commitadas no Jarvis.');
      const proceed = await confirm({
        message: 'Continuar mesmo assim?',
        default: false,
      });
      if (!proceed) {
        info('Update cancelado.');
        return;
      }
    }

    await showLoading('Baixando atualizações', {
      steps: ['git pull', 'Verificando dependências'],
      durationMs: 600,
    });

    try {
      execSync('git pull', { encoding: 'utf-8', stdio: 'inherit' });
    } catch (err) {
      error(`Falha no git pull: ${err.stderr?.trim() || err.message}`);
      process.exit(1);
    }
  }

  await showLoading('Instalando dependências', {
    steps: ['npm install', 'Atualizando pacotes'],
    durationMs: 800,
  });

  try {
    execSync('npm install', { encoding: 'utf-8', stdio: 'inherit' });
    success('Jarvis atualizado com sucesso!');
    blank();
    printBox(
      `${chalk.green('jarvis --help')}   veja os comandos disponíveis`,
      { title: ' pronto ' }
    );
  } catch (err) {
    error(`Falha no npm install: ${err.stderr?.trim() || err.message}`);
    process.exit(1);
  }
}