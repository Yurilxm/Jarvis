#!/usr/bin/env node

import { runCommitFlow } from './commit/flow.js';
import { runMergeFlow } from './commit/merge.js';
import { isGitRepo, getGitStatus, initRepo } from './git/status.js';
import {
  getCurrentBranch,
  listBranches,
  switchBranch,
  createBranch,
  createEmptyCommit,
  hasUncommittedChanges,
} from './git/branch.js';
import { PROTECTED_BRANCH, DEVELOPMENT_BRANCH } from './config/branches.js';
import { runIgnoreMenu } from './ignore/menu.js';
import { runHistoryView } from './history/view.js';
import { confirm } from '@inquirer/prompts';
import {
  printBanner,
  printBox,
  printFileList,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  section,
  showLoading,
  chalk,
  accent,
  muted,
} from './ui.js';

const command = process.argv[2];
const subcommand = process.argv[3];
const arg = process.argv[4];

await main();

async function main() {
  if (command === 'init') {
    await runInitFlow();
  } else if (command === 'ignore') {
    await runIgnoreMenu();
  } else if (command === 'history') {
    const pushedOnly = subcommand === '--pushed' || arg === '--pushed';
    const limitArg = [subcommand, arg].find((v) => v && /^\d+$/.test(v));
    await showLoading('Carregando histórico', {
      steps: ['Lendo .jarvis/history', 'Montando timeline'],
      durationMs: 450,
    });
    await runHistoryView({
      limit: limitArg ? Number(limitArg) : 30,
      pushedOnly,
    });
  } else if (command === 'commit') {
    await runCommitFlow();
  } else if (command === 'merge') {
    await showLoading('Iniciando merge', {
      steps: ['Verificando branches', 'Preparando merge', 'Pronto'],
      durationMs: 700,
    });
    await runMergeFlow(subcommand || null, arg || null);
  } else if (command === 'status') {
    await showLoading('Lendo repositório', {
      steps: ['Checando git', 'Coletando status'],
      durationMs: 500,
    });
    showStatus();
  } else if (command === 'branch') {
    await showLoading('Carregando branches', {
      steps: ['Lendo refs', 'Montando lista'],
      durationMs: 450,
    });
    await handleBranchCommand(subcommand, arg);
  } else {
    await showLoading('Inicializando Jarvis', {
      steps: ['Boot', 'Carregando comandos', 'Pronto'],
      durationMs: 800,
    });
    showHelp();
  }
}

// ─── Init ─────────────────────────────────────────────────

async function runInitFlow() {
  printBanner();

  if (isGitRepo()) {
    warn('Este diretório já é um repositório Git.');
    dim(`Branch atual: ${getCurrentBranch()}`);
    process.exit(0);
  }

  await showLoading('Inicializando repositório', {
    steps: ['Criando .git', `Branch ${PROTECTED_BRANCH}`, 'Finalizando'],
    durationMs: 700,
  });

  const result = initRepo(PROTECTED_BRANCH);
  if (!result.success) {
    error(`Falha ao inicializar: ${result.message}`);
    process.exit(1);
  }

  success(result.message);

  const setupDev = await confirm({
    message: `Criar branch '${DEVELOPMENT_BRANCH}' e commit inicial vazio?`,
    default: true,
  });

  if (setupDev) {
    const commitResult = createEmptyCommit('chore: initial commit');
    if (!commitResult.success) {
      warn(`Não foi possível criar o commit inicial: ${commitResult.message}`);
      dim('Você pode criar a branch depois com: jarvis branch create dev');
    } else {
      success(commitResult.message);
      const branchResult = createBranch(DEVELOPMENT_BRANCH);
      if (!branchResult.success) {
        warn(branchResult.message);
      } else {
        success(branchResult.message);
        const goDev = await confirm({
          message: `Trocar para '${DEVELOPMENT_BRANCH}' agora?`,
          default: true,
        });
        if (goDev) {
          const sw = switchBranch(DEVELOPMENT_BRANCH);
          if (sw.success) {
            success(`Agora você está na branch '${DEVELOPMENT_BRANCH}'.`);
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

// ─── Status ───────────────────────────────────────────────

function showStatus() {
  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    dim('Entre na pasta de um projeto com git, ou rode: jarvis init');
    process.exit(1);
  }

  const branch = getCurrentBranch();
  const branches = listBranches();
  const status = getGitStatus();

  const branchLabel = branch === PROTECTED_BRANCH
    ? chalk.yellow(`${branch} (protegida)`)
    : chalk.green(branch);

  blank();
  printBox(
    `${chalk.bold('Branch')}  ${branchLabel}\n${muted('Locais')}  ${branches.map((b) =>
      b === PROTECTED_BRANCH ? chalk.yellow(b) : b
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

// ─── Branch commands ──────────────────────────────────────

async function handleBranchCommand(sub, arg) {
  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    dim('Rode: jarvis init');
    process.exit(1);
  }

  if (!sub || sub === 'list') {
    listBranchesCmd();
  } else if (sub === 'create') {
    if (!arg) {
      error('Nome da branch é obrigatório.');
      dim('Uso: jarvis branch create <nome>');
      process.exit(1);
    }
    await createBranchCmd(arg);
  } else if (sub === 'switch') {
    if (!arg) {
      error('Nome da branch é obrigatório.');
      dim('Uso: jarvis branch switch <nome>');
      process.exit(1);
    }
    await switchBranchCmd(arg);
  } else {
    error(`Subcomando desconhecido: ${sub}`);
    dim('Use: list, create <nome>, switch <nome>');
    process.exit(1);
  }
}

function listBranchesCmd() {
  const branches = listBranches();
  const current = getCurrentBranch();

  section('Branches locais');
  for (const branch of branches) {
    const marker = branch === current ? chalk.green('●') : muted('○');
    const name = branch === PROTECTED_BRANCH
      ? chalk.yellow(`${branch} (protegida)`)
      : branch === current
        ? chalk.green(branch)
        : branch;
    console.log(`  ${marker}  ${name}`);
  }
  blank();
}

async function createBranchCmd(name) {
  const current = getCurrentBranch();
  info(`Criando branch '${accent(name)}' a partir de '${current}'...`);

  const result = createBranch(name);
  if (!result.success) {
    error(result.message);
    process.exit(1);
  }

  success(result.message);

  const shouldSwitch = await confirm({
    message: `Deseja trocar para a branch '${name}'?`,
    default: true,
  });

  if (shouldSwitch) {
    const switchResult = switchBranch(name);
    if (switchResult.success) {
      success(`Agora você está na branch '${name}'.`);
    } else {
      error(switchResult.message);
    }
  }
}

async function switchBranchCmd(name) {
  const current = getCurrentBranch();

  if (name === current) {
    info(`Você já está na branch '${name}'.`);
    return;
  }

  if (hasUncommittedChanges()) {
    warn('Existem alterações não commitadas na branch atual.');

    const proceed = await confirm({
      message: 'Tentar trocar mesmo assim?',
      default: false,
    });

    if (!proceed) {
      info('Troca cancelada.');
      process.exit(0);
    }
  }

  info(`Trocando para branch '${name}'...`);
  const result = switchBranch(name);

  if (result.success) {
    success(`Agora você está na branch '${name}'.`);
  } else {
    error(`Não foi possível trocar para '${name}':`);
    dim(result.message);
    process.exit(1);
  }
}

// ─── Help ─────────────────────────────────────────────────

function showHelp() {
  printBanner();

  const commands = [
    ['jarvis init', 'Inicializa um repositório Git'],
    ['jarvis ignore', 'Gerencia lista de ignore (IA + manual)'],
    ['jarvis history', 'Histórico de commits/pushes do Jarvis'],
    ['jarvis commit', 'Gera mensagem de commit com IA'],
    ['jarvis merge [origem] [destino]', 'Merge entre branches (dev → main)'],
    ['jarvis status', 'Mostra status do repositório'],
    ['jarvis branch list', 'Lista branches locais'],
    ['jarvis branch create <nome>', 'Cria uma nova branch'],
    ['jarvis branch switch <nome>', 'Troca para uma branch'],
  ];

  const body = commands
    .map(([cmd, desc]) => `${chalk.green(cmd.padEnd(36))} ${muted(desc)}`)
    .join('\n');

  printBox(body, { title: 'comandos' });

  dim(`  Branch protegida: ${chalk.yellow(PROTECTED_BRANCH)}`);
  dim('  Sem git? Rode jarvis init nesta pasta.');
  dim('  Ignore: defaults + .jarvisignore (veja .jarvisignore.example)');
  blank();
}
