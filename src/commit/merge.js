import { getCurrentBranch, hasUncommittedChanges, switchBranch, mergeBranch, hasUnpushedCommits } from '../git/branch.js';
import { PROTECTED_BRANCH, DEVELOPMENT_BRANCH } from '../config/branches.js';
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
  chalk,
} from '../ui.js';

/**
 * Fluxo completo de merge entre branches.
 * @param {string|null} sourceArg - Branch de origem (opcional, default: dev)
 * @param {string|null} targetArg - Branch de destino (opcional, default: main)
 */
export async function runMergeFlow(sourceArg = null, targetArg = null) {
  const source = sourceArg || DEVELOPMENT_BRANCH;
  const target = targetArg || PROTECTED_BRANCH;

  const currentBranch = getCurrentBranch();

  printBanner();
  printBox(
    `${chalk.bold('Origem ')} ${chalk.green(source)}\n${chalk.bold('Destino')} ${chalk.green(target)}`,
    { title: 'merge' }
  );

  if (source === target) {
    error('Origem e destino são a mesma branch.');
    process.exit(1);
  }

  if (hasUncommittedChanges()) {
    error('Existem alterações não commitadas na branch atual.');
    dim('Faça commit ou stash das alterações antes do merge.');
    process.exit(1);
  }

  if (hasUnpushedCommits(source)) {
    warn(`A branch '${source}' possui commits locais não enviados.`);

    const pushChoice = await confirm({
      message: 'Deseja fazer push da origem antes do merge?',
      default: false,
    });

    if (pushChoice) {
      try {
        const originalBranch = currentBranch;
        if (originalBranch !== source) {
          switchBranch(source);
        }
        info(`Executando push da branch '${source}'...`);
        execSync('git push', { encoding: 'utf-8', stdio: 'inherit' });
        if (originalBranch !== source) {
          switchBranch(originalBranch);
        }
      } catch (err) {
        error(`Erro ao fazer push da origem: ${err.message}`);
        process.exit(1);
      }
    } else {
      const continueChoice = await confirm({
        message: 'Continuar merge mesmo assim?',
        default: false,
      });

      if (!continueChoice) {
        info('Merge cancelado.');
        process.exit(0);
      }
    }
  }

  const confirmed = await confirm({
    message: `Confirmar merge de '${source}' em '${target}'?`,
    default: false,
  });

  if (!confirmed) {
    info('Merge cancelado.');
    process.exit(0);
  }

  const originalBranch = currentBranch;

  info(`Trocando para branch '${target}'...`);

  if (originalBranch !== target) {
    const result = switchBranch(target);
    if (!result.success) {
      error(`Não foi possível trocar para '${target}':`);
      dim(result.message);

      if (originalBranch !== target) {
        switchBranch(originalBranch);
      }
      process.exit(1);
    }
  }

  if (hasUncommittedChanges()) {
    error(`A branch '${target}' possui alterações não commitadas.`);
    dim('Resolva as alterações antes do merge.');
    if (originalBranch !== target) {
      switchBranch(originalBranch);
    }
    process.exit(1);
  }

  info(`Executando merge de '${source}' em '${target}'...`);
  const mergeResult = mergeBranch(source);

  if (!mergeResult.success) {
    if (mergeResult.conflicted) {
      blank();
      error('Conflitos detectados durante o merge!');
      dim('Resolva os conflitos manualmente, faça commit e push.');
      dim(`Você está na branch '${target}'.`);
      dim(`Depois de resolver, volte para '${originalBranch}' com: git checkout ${originalBranch}`);
      process.exit(1);
    } else {
      error(`Erro no merge: ${mergeResult.message}`);
      if (originalBranch !== target) {
        switchBranch(originalBranch);
      }
      process.exit(1);
    }
  }

  success('Merge realizado com sucesso!');
  if (mergeResult.message) {
    dim(mergeResult.message);
  }

  const shouldPush = await confirm({
    message: `Deseja fazer push da branch '${target}'?`,
    default: false,
  });

  if (shouldPush) {
    info(`Executando push da branch '${target}'...`);
    try {
      execSync('git push', { encoding: 'utf-8', stdio: 'inherit' });
      success('Push realizado com sucesso!');
    } catch (err) {
      error(`Erro ao executar push: ${err.message}`);
      dim('O merge foi feito localmente, mas o push falhou.');
    }
  }

  const returnBranch = (target === PROTECTED_BRANCH && source === DEVELOPMENT_BRANCH)
    ? DEVELOPMENT_BRANCH
    : originalBranch;

  if (getCurrentBranch() !== returnBranch) {
    blank();
    info(`Voltando para branch '${returnBranch}'...`);
    const result = switchBranch(returnBranch);
    if (!result.success) {
      warn(`Não foi possível voltar para '${returnBranch}': ${result.message}`);
      dim(`Você está na branch '${getCurrentBranch()}'.`);
    } else {
      success(`Agora você está na branch '${returnBranch}'.`);
    }
  }
}
