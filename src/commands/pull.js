import { isGitRepo } from '../git/status.js';
import { getCurrentBranch, hasUncommittedChanges } from '../git/branch.js';
import { confirm } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
import { showLoading, info, success, warn, error, dim, blank, printBox, chalk } from '../ui.js';

export async function runPull() {
  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    process.exit(1);
  }

  const branch = getCurrentBranch();

  if (hasUncommittedChanges()) {
    warn('Existem alterações não commitadas.');
    const proceed = await confirm({
      message: 'Fazer pull mesmo assim? (pode causar conflitos)',
      default: false,
    });
    if (!proceed) {
      info('Pull cancelado.');
      return;
    }
  }

  await showLoading('Atualizando repositório', {
    steps: [`Fetch em ${branch}`, 'Baixando alterações', 'Aplicando'],
    durationMs: 600,
  });

  try {
    const output = execSync('git pull', { encoding: 'utf-8', stdio: 'pipe' });
    success('Repositório atualizado!');
    if (output.trim()) {
      dim(output.trim());
    }
  } catch (err) {
    error(`Falha no pull: ${err.stderr?.trim() || err.message}`);
    process.exit(1);
  }
}