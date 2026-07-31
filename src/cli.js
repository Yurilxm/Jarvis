#!/usr/bin/env node

import { runCommitFlow } from './commit/flow.js';
import { isGitRepo, getGitStatus } from './git/status.js';
import { getCurrentBranch, listBranches } from './git/branch.js';
import chalk from 'chalk';
import logSymbols from 'log-symbols';

const command = process.argv[2];

if (command === 'commit') {
  runCommitFlow();
} else if (command === 'status') {
  showStatus();
} else {
  showHelp();
}

function showStatus() {
  if (!isGitRepo()) {
    console.error(chalk.red(`${logSymbols.error} Este diretório não é um repositório Git.`));
    process.exit(1);
  }

  const branch = getCurrentBranch();
  const branches = listBranches();
  const status = getGitStatus();

  console.log(chalk.bold(`\nBranch atual: ${chalk.green(branch)}`));

  if (branches.length > 0) {
    console.log(chalk.dim(`Branches locais: ${branches.join(', ')}`));
  }

  const total = status.staged.length + status.modified.length + status.deleted.length + status.untracked.length;

  if (total === 0) {
    console.log(chalk.green(`${logSymbols.success} Árvore de trabalho limpa.`));
    return;
  }

  console.log(chalk.yellow(`\n${logSymbols.info} ${total} arquivo(s) com alterações:\n`));

  if (status.staged.length > 0) {
    console.log(chalk.green('  Staged:'));
    for (const file of status.staged) {
      console.log(chalk.dim(`    + ${file}`));
    }
  }

  if (status.modified.length > 0) {
    console.log(chalk.yellow('  Modificados:'));
    for (const file of status.modified) {
      console.log(chalk.dim(`    ~ ${file}`));
    }
  }

  if (status.deleted.length > 0) {
    console.log(chalk.red('  Removidos:'));
    for (const file of status.deleted) {
      console.log(chalk.dim(`    - ${file}`));
    }
  }

  if (status.untracked.length > 0) {
    console.log(chalk.blue('  Não rastreados:'));
    for (const file of status.untracked) {
      console.log(chalk.dim(`    ? ${file}`));
    }
  }

  console.log('');
}

function showHelp() {
  console.log(chalk.bold('Jarvis v1 — Assistente de Commit'));
  console.log('');
  console.log('Uso:');
  console.log(`  ${chalk.green('jarvis commit')}    Gera mensagem de commit com IA e auxilia no commit/push`);
  console.log(`  ${chalk.green('jarvis status')}    Mostra status do repositório (branch, alterações)`);
  console.log('');
  console.log('Execute dentro de um repositório Git.');
}