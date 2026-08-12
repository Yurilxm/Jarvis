import { isGitRepo, initRepo } from '../git/status.js';
import { getCurrentBranch, switchBranch, createBranch, createEmptyCommit } from '../git/branch.js';
import { getProtectedBranch, getDevelopmentBranch } from '../config/branches.js';
import { confirm } from '@inquirer/prompts';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  dim,
  blank,
  showLoading,
  chalk,
  muted,
} from '../ui.js';

export async function runInitFlow() {
  const protectedBranch = getProtectedBranch();
  const developmentBranch = getDevelopmentBranch();
  printBanner();

  if (isGitRepo()) {
    warn('Este diretório já é um repositório Git.');
    dim(`Branch atual: ${getCurrentBranch()}`);
    process.exit(0);
  }

  await showLoading('Inicializando repositório', {
    steps: ['Criando .git', `Branch ${protectedBranch}`, 'Finalizando'],
    durationMs: 700,
  });

  const result = initRepo(protectedBranch);
  if (!result.success) {
    error(`Falha ao inicializar: ${result.message}`);
    process.exit(1);
  }

  success(result.message);

  const setupDev = await confirm({
    message: `Criar branch '${developmentBranch}' e commit inicial vazio?`,
    default: true,
  });

  if (setupDev) {
    const commitResult = createEmptyCommit('chore: initial commit');
    if (!commitResult.success) {
      warn(`Não foi possível criar o commit inicial: ${commitResult.message}`);
      dim('Você pode criar a branch depois com: jarvis branch create dev');
    } else {
      success(commitResult.message);
      const branchResult = createBranch(developmentBranch);
      if (!branchResult.success) {
        warn(branchResult.message);
      } else {
        success(branchResult.message);
        const goDev = await confirm({
          message: `Trocar para '${developmentBranch}' agora?`,
          default: true,
        });
        if (goDev) {
          const sw = switchBranch(developmentBranch);
          if (sw.success) {
            success(`Agora você está na branch '${developmentBranch}'.`);
          } else {
            warn(sw.message);
          }
        }
      }
    }
  }

  blank();
  printBox(
    `${muted('Próximos passos')}\n` +
    `${chalk.green('jarvis status')}   ver arquivos\n` +
    `${chalk.green('jarvis commit')}   gerar commit com IA`,
    { title: ' pronto ' }
  );
}