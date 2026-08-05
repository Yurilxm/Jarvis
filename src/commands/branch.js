import { isGitRepo } from '../git/status.js';
import {
  getCurrentBranch,
  listBranches,
  switchBranch,
  createBranch,
  hasUncommittedChanges,
} from '../git/branch.js';
import { PROTECTED_BRANCH } from '../config/branches.js';
import { confirm } from '@inquirer/prompts';
import {
  info,
  success,
  warn,
  error,
  dim,
  section,
  chalk,
  accent,
  muted,
} from '../ui.js';

export async function handleBranchCommand(sub, arg) {
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
  console.log('');
}

export async function createBranchCmd(name) {
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

export async function switchBranchCmd(name) {
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
    warn(`Branch '${name}' não existe.`);

    const createIt = await confirm({
      message: `Deseja criar a branch '${name}'?`,
      default: true,
    });

    if (createIt) {
      const createResult = createBranch(name);
      if (!createResult.success) {
        error(createResult.message);
        process.exit(1);
      }
      success(`Branch '${name}' criada.`);

      const switchResult = switchBranch(name);
      if (switchResult.success) {
        success(`Agora você está na branch '${name}'.`);
      } else {
        error(`Não foi possível trocar para '${name}': ${switchResult.message}`);
        process.exit(1);
      }
    } else {
      info('Troca cancelada.');
      process.exit(0);
    }
  }
}