#!/usr/bin/env node

import { runCommitFlow } from './commit/flow.js';
import { runMergeFlow } from './commit/merge.js';
import { isGitRepo, getGitStatus } from './git/status.js';
import {
  getCurrentBranch,
  listBranches,
  switchBranch,
  createBranch,
  hasUncommittedChanges,
} from './git/branch.js';
import { prList, prView, prDiff, prReview, prCheckout, prApprove, prRequestChanges, prComment, prMerge, prClose } from './pr/flow.js';
import { PROTECTED_BRANCH } from './config/branches.js';
import { confirm, input } from '@inquirer/prompts';
import chalk from 'chalk';
import logSymbols from 'log-symbols';

const command = process.argv[2];
const subcommand = process.argv[3];
const arg = process.argv[4];

if (command === 'commit') {
  runCommitFlow();
} else if (command === 'merge') {
  const source = subcommand || null;
  const target = arg || null;
  runMergeFlow(source, target);
} else if (command === 'status') {
  showStatus();
} else if (command === 'branch') {
  handleBranchCommand(subcommand, arg);
} else if (command === 'pr') {
  handlePrCommand(subcommand, arg);
} else {
  showHelp();
}

// ─── PR commands ──────────────────────────────────────────

async function handlePrCommand(sub, arg) {
  if (!isGitRepo()) {
    console.error(chalk.red(`${logSymbols.error} Este diretório não é um repositório Git.`));
    process.exit(1);
  }

  if (!sub || sub === 'list') {
    await prList();
  } else if (sub === 'view') {
    if (!arg) { console.error(chalk.red(`${logSymbols.error} Número da PR é obrigatório.`)); process.exit(1); }
    await prView(parseInt(arg));
  } else if (sub === 'diff') {
    if (!arg) { console.error(chalk.red(`${logSymbols.error} Número da PR é obrigatório.`)); process.exit(1); }
    await prDiff(parseInt(arg));
  } else if (sub === 'review') {
    if (!arg) { console.error(chalk.red(`${logSymbols.error} Número da PR é obrigatório.`)); process.exit(1); }
    await prReview(parseInt(arg));
  } else if (sub === 'checkout') {
    if (!arg) { console.error(chalk.red(`${logSymbols.error} Número da PR é obrigatório.`)); process.exit(1); }
    await prCheckout(parseInt(arg));
  } else if (sub === 'approve') {
    if (!arg) { console.error(chalk.red(`${logSymbols.error} Número da PR é obrigatório.`)); process.exit(1); }
    await prApprove(parseInt(arg));
  } else if (sub === 'request-changes') {
    if (!arg) { console.error(chalk.red(`${logSymbols.error} Número da PR é obrigatório.`)); process.exit(1); }
    await prRequestChanges(parseInt(arg));
  } else if (sub === 'comment') {
    if (!arg) { console.error(chalk.red(`${logSymbols.error} Número da PR é obrigatório.`)); process.exit(1); }
    await prComment(parseInt(arg));
  } else if (sub === 'merge') {
    if (!arg) { console.error(chalk.red(`${logSymbols.error} Número da PR é obrigatório.`)); process.exit(1); }
    await prMerge(parseInt(arg));
  } else if (sub === 'close') {
    if (!arg) { console.error(chalk.red(`${logSymbols.error} Número da PR é obrigatório.`)); process.exit(1); }
    await prClose(parseInt(arg));
  } else {
    console.error(chalk.red(`${logSymbols.error} Subcomando desconhecido: ${sub}`));
    console.log(chalk.dim('Use: list, view <n>, diff <n>, review <n>, checkout <n>, approve <n>, request-changes <n>, comment <n>, merge <n>, close <n>'));
    process.exit(1);
  }
}

// ─── Status ───────────────────────────────────────────────

function showStatus() {
  if (!isGitRepo()) {
    console.error(chalk.red(`${logSymbols.error} Este diretório não é um repositório Git.`));
    process.exit(1);
  }

  const branch = getCurrentBranch();
  const branches = listBranches();
  const status = getGitStatus();

  const branchLabel = branch === PROTECTED_BRANCH
    ? chalk.yellow(`${branch} (protegida)`)
    : chalk.green(branch);

  console.log(chalk.bold(`\nBranch atual: ${branchLabel}`));

  if (branches.length > 0) {
    const formatted = branches.map(b =>
      b === PROTECTED_BRANCH ? chalk.yellow(b) : b
    );
    console.log(chalk.dim(`Branches locais: ${formatted.join(', ')}`));
  }

  const total = status.staged.length + status.modified.length +
                status.deleted.length + status.untracked.length;

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

// ─── Branch commands ──────────────────────────────────────

async function handleBranchCommand(sub, arg) {
  if (!isGitRepo()) {
    console.error(chalk.red(`${logSymbols.error} Este diretório não é um repositório Git.`));
    process.exit(1);
  }

  if (!sub || sub === 'list') {
    listBranchesCmd();
  } else if (sub === 'create') {
    if (!arg) {
      console.error(chalk.red(`${logSymbols.error} Nome da branch é obrigatório.`));
      console.log(chalk.dim('Uso: jarvis branch create <nome>'));
      process.exit(1);
    }
    await createBranchCmd(arg);
  } else if (sub === 'switch') {
    if (!arg) {
      console.error(chalk.red(`${logSymbols.error} Nome da branch é obrigatório.`));
      console.log(chalk.dim('Uso: jarvis branch switch <nome>'));
      process.exit(1);
    }
    await switchBranchCmd(arg);
  } else {
    console.error(chalk.red(`${logSymbols.error} Subcomando desconhecido: ${sub}`));
    console.log(chalk.dim('Use: list, create <nome>, switch <nome>'));
    process.exit(1);
  }
}

function listBranchesCmd() {
  const branches = listBranches();
  const current = getCurrentBranch();

  console.log(chalk.bold('\nBranches locais:'));
  for (const branch of branches) {
    const marker = branch === current ? chalk.green('*') : ' ';
    const name = branch === PROTECTED_BRANCH
      ? chalk.yellow(`${branch} (protegida)`)
      : branch;
    console.log(`  ${marker} ${name}`);
  }
  console.log('');
}

async function createBranchCmd(name) {
  const current = getCurrentBranch();
  console.log(chalk.blue(`\n${logSymbols.info} Criando branch '${name}' a partir de '${current}'...`));

  const result = createBranch(name);
  if (!result.success) {
    console.error(chalk.red(`${logSymbols.error} ${result.message}`));
    process.exit(1);
  }

  console.log(chalk.green(`${logSymbols.success} ${result.message}`));

  const shouldSwitch = await confirm({
    message: `Deseja trocar para a branch '${name}'?`,
    default: true,
  });

  if (shouldSwitch) {
    const switchResult = switchBranch(name);
    if (switchResult.success) {
      console.log(chalk.green(`${logSymbols.success} Agora você está na branch '${name}'.`));
    } else {
      console.error(chalk.red(`${logSymbols.error} ${switchResult.message}`));
    }
  }
}

async function switchBranchCmd(name) {
  const current = getCurrentBranch();

  if (name === current) {
    console.log(chalk.yellow(`${logSymbols.info} Você já está na branch '${name}'.`));
    return;
  }

  if (hasUncommittedChanges()) {
    console.warn(chalk.yellow(`${logSymbols.warning} Existem alterações não commitadas na branch atual.`));

    const proceed = await confirm({
      message: 'Tentar trocar mesmo assim?',
      default: false,
    });

    if (!proceed) {
      console.log(chalk.yellow(`${logSymbols.info} Troca cancelada.`));
      process.exit(0);
    }
  }

  console.log(chalk.blue(`${logSymbols.info} Trocando para branch '${name}'...`));
  const result = switchBranch(name);

  if (result.success) {
    console.log(chalk.green(`${logSymbols.success} Agora você está na branch '${name}'.`));
  } else {
    console.error(chalk.red(`${logSymbols.error} Não foi possível trocar para '${name}':`));
    console.error(chalk.dim(result.message));
    process.exit(1);
  }
}

// ─── Help ─────────────────────────────────────────────────

function showHelp() {
  console.log(chalk.bold('Jarvis v1 — Assistente de Commit'));
  console.log('');
  console.log('Comandos:');
  console.log(`  ${chalk.green('jarvis commit')}                       Gera mensagem de commit com IA`);
  console.log(`  ${chalk.green('jarvis merge [origem] [destino]')}       Faz merge entre branches`);
  console.log(`  ${chalk.green('jarvis status')}                       Mostra status do repositório`);
  console.log(`  ${chalk.green('jarvis branch list')}                  Lista branches locais`);
  console.log(`  ${chalk.green('jarvis branch create <nome>')}         Cria uma nova branch`);
  console.log(`  ${chalk.green('jarvis branch switch <nome>')}         Troca para uma branch`);
  console.log('');
  console.log(`  ${chalk.green('jarvis pr list')}                      Lista PRs abertas`);
  console.log(`  ${chalk.green('jarvis pr view <n>')}                  Detalhes de uma PR`);
  console.log(`  ${chalk.green('jarvis pr diff <n>')}                  Diff de uma PR`);
  console.log(`  ${chalk.green('jarvis pr review <n>')}                Revisão com IA`);
  console.log(`  ${chalk.green('jarvis pr checkout <n>')}              Fazer checkout da branch da PR`);
  console.log(`  ${chalk.green('jarvis pr approve <n>')}               Aprovar PR`);
  console.log(`  ${chalk.green('jarvis pr request-changes <n>')}       Solicitar alterações`);
  console.log(`  ${chalk.green('jarvis pr comment <n>')}               Comentar em uma PR`);
  console.log(`  ${chalk.green('jarvis pr merge <n>')}                 Fazer merge da PR`);
  console.log(`  ${chalk.green('jarvis pr close <n>')}                 Fechar PR sem merge`);
  console.log('');
  console.log(`Branch protegida: ${chalk.yellow(PROTECTED_BRANCH)}`);
  console.log('Execute dentro de um repositório Git.');
}