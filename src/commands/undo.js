import { isGitRepo } from '../git/status.js';
import { getCurrentBranch, getPushRemote } from '../git/branch.js';
import { confirm } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
import { info, success, warn, error, dim, blank } from '../ui.js';

export async function runUndo() {
  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    process.exit(1);
  }

  let lastCommit;
  try {
    lastCommit = execSync('git log -1 --oneline --no-decorate', { encoding: 'utf-8' }).trim();
  } catch {
    // sem commits
  }

  if (!lastCommit) {
    info('Nenhum commit para desfazer.');
    return;
  }

  blank();
  warn('Último commit:');
  dim(`  ${lastCommit}`);

  const confirmed = await confirm({
    message: 'Desfazer este commit? (git reset --soft HEAD~1)',
    default: false,
  });

  if (!confirmed) {
    info('Undo cancelado.');
    return;
  }

  const hasRemote = getPushRemote(getCurrentBranch());
  if (hasRemote) {
    warn('A branch atual tem remote configurado.');
    const pushConfirmed = await confirm({
      message: 'Se você já fez push, desfazer localmente pode causar divergência. Continuar?',
      default: false,
    });

    if (!pushConfirmed) {
      info('Undo cancelado.');
      return;
    }
  }

  try {
    execSync('git reset --soft HEAD~1', { encoding: 'utf-8', stdio: 'inherit' });
    success('Commit desfeito. As alterações estão no staged.');
    dim('Use jarvis commit para commitar novamente quando estiver pronto.');
  } catch (err) {
    error(`Erro ao desfazer commit: ${err.message}`);
    process.exit(1);
  }
}