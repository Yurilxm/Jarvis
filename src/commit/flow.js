import { isGitRepo, getGitStatus } from '../git/status.js';
import { getFullDiff } from '../git/diff.js';
import { sanitizeDiff, filterSensitiveFiles } from './sanitize.js';
import { buildCommitPrompt } from './promptBuilder.js';
import { askAI } from '../ai/client.js';
import { getCurrentBranch, hasUncommittedChanges, switchBranch, getPushRemote } from '../git/branch.js';
import { PROTECTED_BRANCH, DEVELOPMENT_BRANCH } from '../config/branches.js';
import { confirm, input, select } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import logSymbols from 'log-symbols';

/**
 * Fluxo completo do assistente de commit.
 */
export async function runCommitFlow() {
  // 1. Verificar se é um repositório Git
  if (!isGitRepo()) {
    console.error(chalk.red(`${logSymbols.error} Este diretório não é um repositório Git.`));
    console.error(chalk.dim('Execute o Jarvis dentro de um projeto com git init.'));
    process.exit(1);
  }

  const branch = getCurrentBranch();

  // 2. Proteção da main
  if (branch === PROTECTED_BRANCH) {
    console.warn(chalk.yellow(`\n${logSymbols.warning} Você está na branch '${PROTECTED_BRANCH}' (protegida).`));
    console.warn(chalk.dim('Commits diretos na main não são recomendados.'));

    const choice = await select({
      message: 'O que deseja fazer?',
      choices: [
        { name: `Trocar para '${DEVELOPMENT_BRANCH}'`, value: 'switch' },
        { name: `Continuar na '${PROTECTED_BRANCH}'`, value: 'continue' },
        { name: 'Cancelar', value: 'cancel' },
      ],
    });

    if (choice === 'cancel') {
      console.log(chalk.yellow(`${logSymbols.info} Commit cancelado.`));
      process.exit(0);
    }

    if (choice === 'switch') {
      // Verificar se há alterações não commitadas
      if (hasUncommittedChanges()) {
        console.warn(chalk.yellow(`${logSymbols.warning} Existem alterações não commitadas.`));

        const forceChoice = await confirm({
          message: 'Tentar trocar mesmo assim? (alterações podem ser perdidas)',
          default: false,
        });

        if (!forceChoice) {
          console.log(chalk.yellow(`${logSymbols.info} Faça commit ou stash das alterações e tente novamente.`));
          process.exit(0);
        }
      }

      const result = switchBranch(DEVELOPMENT_BRANCH);
      if (!result.success) {
        console.error(chalk.red(`${logSymbols.error} Não foi possível trocar para '${DEVELOPMENT_BRANCH}':`));
        console.error(chalk.dim(result.message));
        process.exit(1);
      }

      console.log(chalk.green(`${logSymbols.success} Agora você está na branch '${DEVELOPMENT_BRANCH}'.`));
      console.log(chalk.dim('Execute jarvis commit novamente para commitar suas alterações.'));
      process.exit(0);
    }

    if (choice === 'continue') {
      const confirmed = await confirm({
        message: chalk.red(`Tem certeza que deseja commitar diretamente na '${PROTECTED_BRANCH}'?`),
        default: false,
      });

      if (!confirmed) {
        console.log(chalk.yellow(`${logSymbols.info} Commit cancelado.`));
        process.exit(0);
      }

      console.warn(chalk.yellow(`${logSymbols.warning} Prosseguindo com commit na '${PROTECTED_BRANCH}'...`));
    }
  }

  // 3. Obter status do Git
  const status = getGitStatus();
  const allChangedFiles = [
    ...status.staged,
    ...status.modified,
    ...status.deleted,
    ...status.untracked,
  ];

  const uniqueFiles = [...new Set(allChangedFiles)];

  if (uniqueFiles.length === 0) {
    console.log(chalk.yellow(`${logSymbols.info} Nenhuma alteração detectada. Não há nada para commit.`));
    process.exit(0);
  }

  // 4. Filtrar arquivos sensíveis
  const { safe, blocked } = filterSensitiveFiles(uniqueFiles);

  if (blocked.length > 0) {
    console.warn(chalk.yellow(`${logSymbols.warning} Arquivos sensíveis detectados e ignorados:`));
    for (const file of blocked) {
      console.warn(chalk.dim(`   - ${file}`));
    }
  }

  if (safe.length === 0) {
    console.log(chalk.yellow(`${logSymbols.info} Todos os arquivos alterados são sensíveis. Nada a analisar.`));
    process.exit(0);
  }

  console.log(chalk.blue(`${logSymbols.info} Branch: ${chalk.green(branch)} | ${safe.length} arquivo(s) para analisar:`));
  for (const file of safe) {
    console.log(chalk.dim(`   - ${file}`));
  }

  // 5. Obter e sanitizar o diff
  const rawDiff = getFullDiff();
  const { sanitized, warnings } = sanitizeDiff(rawDiff);

  if (warnings.length > 0) {
    console.warn(chalk.yellow(`${logSymbols.warning} Conteúdo sensível removido do diff antes do envio à IA.`));
  }

  if (!sanitized.trim()) {
    console.log(chalk.yellow(`${logSymbols.info} Nenhum conteúdo relevante no diff para analisar.`));
    process.exit(0);
  }

  // 6. Enviar para a IA
  console.log(chalk.blue(`\n${logSymbols.info} Gerando mensagem de commit com IA...`));
  const prompt = buildCommitPrompt(sanitized);

  let message;
  try {
    message = await askAI(prompt);
  } catch (error) {
    console.error(chalk.red(`${logSymbols.error} Erro ao comunicar com a IA: ${error.message}`));
    process.exit(1);
  }

  // 7. Loop de aprovação/edição
  while (true) {
    console.log(chalk.bold(`\n${logSymbols.info} Mensagem sugerida:`));
    console.log(chalk.dim('─'.repeat(50)));
    console.log(message);
    console.log(chalk.dim('─'.repeat(50)));

    const action = await input({
      message: 'O que deseja fazer? (a)provar / (e)ditar / (g)erar novamente / (c)ancelar',
      validate: (value) => {
        const v = value.toLowerCase();
        if (['a', 'e', 'g', 'c'].includes(v)) return true;
        return 'Digite a, e, g ou c';
      }
    });

    const choice = action.toLowerCase();

    if (choice === 'c') {
      console.log(chalk.yellow(`${logSymbols.info} Commit cancelado.`));
      process.exit(0);
    }

    if (choice === 'a') {
      break;
    }

    if (choice === 'e') {
      message = await input({
        message: 'Edite a mensagem:',
        default: message,
      });
      break;
    }

    if (choice === 'g') {
      console.log(chalk.blue(`\n${logSymbols.info} Gerando nova mensagem...`));
      try {
        message = await askAI(prompt);
      } catch (error) {
        console.error(chalk.red(`${logSymbols.error} Erro ao comunicar com a IA: ${error.message}`));
        process.exit(1);
      }
    }
  }

  // 8. Executar git add e git commit
  console.log(chalk.blue(`\n${logSymbols.info} Executando git add...`));
  try {
    execSync('git add .', { encoding: 'utf-8', stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.red(`${logSymbols.error} Erro ao executar git add: ${error.message}`));
    process.exit(1);
  }

  console.log(chalk.blue(`${logSymbols.info} Executando git commit...`));

  const bodySeparator = '---BODY---';
  let title = message;
  let body = '';

  if (message.includes(bodySeparator)) {
    const parts = message.split(bodySeparator);
    title = parts[0].trim();
    body = parts.slice(1).join(bodySeparator).trim();
  }

  const escapedTitle = title.replace(/"/g, '\\"');
  const escapedBody = body.replace(/"/g, '\\"');

  try {
    if (body) {
      execSync(`git commit -m "${escapedTitle}" -m "${escapedBody}"`, {
        encoding: 'utf-8',
        stdio: 'inherit',
      });
    } else {
      execSync(`git commit -m "${escapedTitle}"`, {
        encoding: 'utf-8',
        stdio: 'inherit',
      });
    }
  } catch (error) {
    console.error(chalk.red(`${logSymbols.error} Erro ao executar git commit: ${error.message}`));
    console.error(chalk.dim('Os arquivos foram adicionados (git add) mas o commit falhou.'));
    process.exit(1);
  }

  console.log(chalk.green(`${logSymbols.success} Commit realizado com sucesso!`));

  // 9. Perguntar sobre push
  const currentBranchAfterCommit = getCurrentBranch();

  const shouldPush = await confirm({
    message: `Deseja fazer push da branch '${currentBranchAfterCommit}'?`,
    default: false,
  });

  if (shouldPush) {
    console.log(chalk.blue(`${logSymbols.info} Executando git push...`));
    try {
        const pushRemote = getPushRemote(currentBranchAfterCommit);
        if (pushRemote) {
        execSync('git push', { encoding: 'utf-8', stdio: 'inherit' });
        } else {
        execSync(`git push --set-upstream origin ${currentBranchAfterCommit}`, {
            encoding: 'utf-8',
            stdio: 'inherit',
        });
        }
        console.log(chalk.green(`${logSymbols.success} Push realizado com sucesso!`));

        // 10. Se for dev, sugerir merge
        if (currentBranchAfterCommit === DEVELOPMENT_BRANCH) {
        console.log('');
        const mergeChoice = await select({
            message: 'Deseja iniciar o merge dev → main?',
            choices: [
            { name: 'Iniciar merge agora', value: 'now' },
            { name: 'Testar depois', value: 'later' },
            { name: 'Não', value: 'no' },
            ],
        });

        if (mergeChoice === 'now') {
            const { runMergeFlow } = await import('./merge.js');
            await runMergeFlow();
        } else if (mergeChoice === 'later') {
            console.log(chalk.dim('Merge adiado. Execute jarvis merge quando estiver pronto.'));
        }
        }
    } catch (error) {
        console.error(chalk.red(`${logSymbols.error} Erro ao executar git push: ${error.message}`));
        console.error(chalk.dim('O commit foi feito localmente, mas o push falhou.'));
        process.exit(1);
    }
    } else {
    console.log(chalk.dim('Push não realizado. Lembre-se de fazer push manualmente.'));
    }
}