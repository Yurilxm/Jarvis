import { getCurrentBranch, hasUncommittedChanges, switchBranch, mergeBranch, hasUnpushedCommits } from '../git/branch.js';
import { PROTECTED_BRANCH, DEVELOPMENT_BRANCH } from '../config/branches.js';
import { confirm } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import logSymbols from 'log-symbols';

/**
 * Fluxo completo de merge entre branches.
 * @param {string|null} sourceArg - Branch de origem (opcional, default: dev)
 * @param {string|null} targetArg - Branch de destino (opcional, default: main)
 */
export async function runMergeFlow(sourceArg = null, targetArg = null) {
  const source = sourceArg || DEVELOPMENT_BRANCH;
  const target = targetArg || PROTECTED_BRANCH;

  const currentBranch = getCurrentBranch();

  // Mostrar o que será feito
  console.log(chalk.bold(`\n${logSymbols.info} Merge`));
  console.log(`  Origem:  ${chalk.green(source)}`);
  console.log(`  Destino: ${chalk.green(target)}`);
  console.log('');

  // Verificar se origem e destino são diferentes
  if (source === target) {
    console.error(chalk.red(`${logSymbols.error} Origem e destino são a mesma branch.`));
    process.exit(1);
  }

  // Verificar alterações não commitadas na branch atual
  if (hasUncommittedChanges()) {
    console.error(chalk.red(`${logSymbols.error} Existem alterações não commitadas na branch atual.`));
    console.error(chalk.dim('Faça commit ou stash das alterações antes do merge.'));
    process.exit(1);
  }

  // Verificar se a origem tem commits não enviados
  if (hasUnpushedCommits(source)) {
    console.warn(chalk.yellow(`${logSymbols.warning} A branch '${source}' possui commits locais não enviados.`));

    const pushChoice = await confirm({
      message: 'Deseja fazer push da origem antes do merge?',
      default: false,
    });

    if (pushChoice) {
      try {
        // Troca para a origem, faz push, volta
        const originalBranch = currentBranch;
        if (originalBranch !== source) {
          switchBranch(source);
        }
        console.log(chalk.blue(`${logSymbols.info} Executando push da branch '${source}'...`));
        execSync('git push', { encoding: 'utf-8', stdio: 'inherit' });
        if (originalBranch !== source) {
          switchBranch(originalBranch);
        }
      } catch (error) {
        console.error(chalk.red(`${logSymbols.error} Erro ao fazer push da origem: ${error.message}`));
        process.exit(1);
      }
    } else {
      const continueChoice = await confirm({
        message: 'Continuar merge mesmo assim?',
        default: false,
      });

      if (!continueChoice) {
        console.log(chalk.yellow(`${logSymbols.info} Merge cancelado.`));
        process.exit(0);
      }
    }
  }

  // Confirmação explícita
  const confirmed = await confirm({
    message: `Confirmar merge de '${source}' em '${target}'?`,
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.yellow(`${logSymbols.info} Merge cancelado.`));
    process.exit(0);
  }

  // Salvar branch original para voltar depois
  const originalBranch = currentBranch;

  // Trocar para a branch de destino
  console.log(chalk.blue(`\n${logSymbols.info} Trocando para branch '${target}'...`));

  if (originalBranch !== target) {
    // Verificar alterações na branch de destino antes de trocar (não conseguimos verificar sem trocar,
    // mas fazemos o checkout e se falhar, mostramos o erro)
    const result = switchBranch(target);
    if (!result.success) {
      console.error(chalk.red(`${logSymbols.error} Não foi possível trocar para '${target}':`));
      console.error(chalk.dim(result.message));

      // Tentar voltar
      if (originalBranch !== target) {
        switchBranch(originalBranch);
      }
      process.exit(1);
    }
  }

  // Verificar novamente alterações não commitadas (agora na target)
  if (hasUncommittedChanges()) {
    console.error(chalk.red(`${logSymbols.error} A branch '${target}' possui alterações não commitadas.`));
    console.error(chalk.dim('Resolva as alterações antes do merge.'));
    // Voltar para a branch original
    if (originalBranch !== target) {
      switchBranch(originalBranch);
    }
    process.exit(1);
  }

  // Executar o merge
  console.log(chalk.blue(`${logSymbols.info} Executando merge de '${source}' em '${target}'...`));
  const mergeResult = mergeBranch(source);

  if (!mergeResult.success) {
    if (mergeResult.conflicted) {
      console.error(chalk.red(`\n${logSymbols.error} Conflitos detectados durante o merge!`));
      console.error(chalk.dim('Resolva os conflitos manualmente, faça commit e push.'));
      console.error(chalk.dim(`Você está na branch '${target}'.`));
      console.error(chalk.dim(`Depois de resolver, volte para '${originalBranch}' com: git checkout ${originalBranch}`));
      process.exit(1);
    } else {
      console.error(chalk.red(`${logSymbols.error} Erro no merge: ${mergeResult.message}`));
      if (originalBranch !== target) {
        switchBranch(originalBranch);
      }
      process.exit(1);
    }
  }

  console.log(chalk.green(`\n${logSymbols.success} Merge realizado com sucesso!`));
  console.log(chalk.dim(mergeResult.message));

  // Perguntar sobre push da target
  const shouldPush = await confirm({
    message: `Deseja fazer push da branch '${target}'?`,
    default: false,
  });

  if (shouldPush) {
    console.log(chalk.blue(`${logSymbols.info} Executando push da branch '${target}'...`));
    try {
      execSync('git push', { encoding: 'utf-8', stdio: 'inherit' });
      console.log(chalk.green(`${logSymbols.success} Push realizado com sucesso!`));
    } catch (error) {
      console.error(chalk.red(`${logSymbols.error} Erro ao executar push: ${error.message}`));
      console.error(chalk.dim('O merge foi feito localmente, mas o push falhou.'));
    }
  }

  // Voltar para a branch original (ou dev no fluxo padrão)
  const returnBranch = (target === PROTECTED_BRANCH && source === DEVELOPMENT_BRANCH)
    ? DEVELOPMENT_BRANCH
    : originalBranch;

  if (getCurrentBranch() !== returnBranch) {
    console.log(chalk.blue(`\n${logSymbols.info} Voltando para branch '${returnBranch}'...`));
    const result = switchBranch(returnBranch);
    if (!result.success) {
      console.warn(chalk.yellow(`${logSymbols.warning} Não foi possível voltar para '${returnBranch}': ${result.message}`));
      console.warn(chalk.dim(`Você está na branch '${getCurrentBranch()}'.`));
    } else {
      console.log(chalk.green(`${logSymbols.success} Agora você está na branch '${returnBranch}'.`));
    }
  }
}