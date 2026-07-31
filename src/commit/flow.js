import { isGitRepo, getGitStatus } from '../git/status.js';
import { getFullDiff } from '../git/diff.js';
import { sanitizeDiff, filterSensitiveFiles } from './sanitize.js';
import { buildCommitPrompt } from './promptBuilder.js';
import { askAI } from '../ai/client.js';
import { getCurrentBranch } from '../git/branch.js';
import { confirm, input } from '@inquirer/prompts';
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

  // 2. Obter status do Git
  const status = getGitStatus();
  const allChangedFiles = [
    ...status.staged,
    ...status.modified,
    ...status.deleted,
    ...status.untracked,
  ];

  // Remove duplicatas
  const uniqueFiles = [...new Set(allChangedFiles)];

  if (uniqueFiles.length === 0) {
    console.log(chalk.yellow(`${logSymbols.info} Nenhuma alteração detectada. Não há nada para commit.`));
    process.exit(0);
  }

  // 3. Filtrar arquivos sensíveis
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

  // 4. Obter e sanitizar o diff
  const rawDiff = getFullDiff();
  const { sanitized, warnings } = sanitizeDiff(rawDiff);

  if (warnings.length > 0) {
    console.warn(chalk.yellow(`${logSymbols.warning} Conteúdo sensível removido do diff antes do envio à IA.`));
  }

  if (!sanitized.trim()) {
    console.log(chalk.yellow(`${logSymbols.info} Nenhum conteúdo relevante no diff para analisar.`));
    process.exit(0);
  }

  // 5. Enviar para a IA
  console.log(chalk.blue(`\n${logSymbols.info} Gerando mensagem de commit com IA...`));
  const prompt = buildCommitPrompt(sanitized);

  let message;
  try {
    message = await askAI(prompt);
  } catch (error) {
    console.error(chalk.red(`${logSymbols.error} Erro ao comunicar com a IA: ${error.message}`));
    process.exit(1);
  }

  // 6. Loop de aprovação/edição
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

  // 7. Executar git add e git commit
  console.log(chalk.blue(`\n${logSymbols.info} Executando git add...`));
  try {
    execSync('git add .', { encoding: 'utf-8', stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.red(`${logSymbols.error} Erro ao executar git add: ${error.message}`));
    process.exit(1);
  }

  console.log(chalk.blue(`${logSymbols.info} Executando git commit...`));

  // Separar título e corpo
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

  // 8. Perguntar sobre push
  const shouldPush = await confirm({
    message: 'Deseja fazer push?',
    default: false,
  });

  if (shouldPush) {
    console.log(chalk.blue(`${logSymbols.info} Executando git push...`));
    try {
      execSync('git push', { encoding: 'utf-8', stdio: 'inherit' });
      console.log(chalk.green(`${logSymbols.success} Push realizado com sucesso!`));
    } catch (error) {
      console.error(chalk.red(`${logSymbols.error} Erro ao executar git push: ${error.message}`));
      console.error(chalk.dim('O commit foi feito localmente, mas o push falhou.'));
      process.exit(1);
    }
  } else {
    console.log(chalk.dim('Push não realizado. Lembre-se de fazer push manualmente.'));
  }
}