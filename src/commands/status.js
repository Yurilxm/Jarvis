import { isGitRepo, getGitStatus } from '../git/status.js';
import { getCurrentBranch, listBranches } from '../git/branch.js';
import { getProtectedBranch } from '../config/branches.js';
import {
  printBox,
  printFileList,
  success,
  error,
  dim,
  blank,
  section,
  chalk,
  muted,
} from '../ui.js';

export function showStatus() {
  const protectedBranch = getProtectedBranch();
  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    dim('Entre na pasta de um projeto com git, ou rode: jarvis init');
    process.exit(1);
  }

  const branch = getCurrentBranch();
  const branches = listBranches();
  const status = getGitStatus();

  const branchLabel = branch === protectedBranch
    ? chalk.yellow(`${branch} (protegida)`)
    : chalk.green(branch);

  blank();
  printBox(
    `${chalk.bold('Branch')}  ${branchLabel}\n${muted('Locais')}  ${branches.map((b) =>
      b === protectedBranch ? chalk.yellow(b) : b
    ).join(muted(' · '))}`,
    { title: 'status' }
  );

  const total = status.staged.length + status.modified.length +
                status.deleted.length + status.untracked.length;

  if (total === 0) {
    success('Árvore de trabalho limpa.');
    blank();
    return;
  }

  section(`${total} arquivo(s) com alterações`);

  if (status.staged.length > 0) {
    console.log(chalk.green('  staged'));
    printFileList(status.staged, { bullet: '+', color: 'green' });
  }

  if (status.modified.length > 0) {
    console.log(chalk.yellow('  modificados'));
    printFileList(status.modified, { bullet: '~', color: 'yellow' });
  }

  if (status.deleted.length > 0) {
    console.log(chalk.red('  removidos'));
    printFileList(status.deleted, { bullet: '-', color: 'red' });
  }

  if (status.untracked.length > 0) {
    console.log(chalk.blue('  não rastreados'));
    printFileList(status.untracked, { bullet: '?', color: 'blue' });
  }

  blank();
}