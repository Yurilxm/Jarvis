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
import { prList, prView, prDiff, prReview, prCheckout, prApprove, prRequestChanges, prComment, prMerge, prClose } from './pr/flow.js';
import { PROTECTED_BRANCH, DEVELOPMENT_BRANCH } from './config/branches.js';
import { runIgnoreMenu } from './ignore/menu.js';
import { runHistoryView } from './history/view.js';
import { confirm, input, select } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
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
  spinner,
  chalk,
  accent,
  muted,
} from './ui.js';
import { loadProfile, saveProfile, deleteProfile } from './config/profile.js';
import { fetchGitHubUser } from './github/user.js';
import { GITHUB_TOKEN } from './config/env.js';
import { jiraList, jiraView, jiraStatus, jiraMove, jiraCreate } from './jira/flow.js';
import { runReviewFlow } from './review/flow.js';
import { runDocsFlow } from './docs/flow.js';
import { getProjectConfig } from './config/project.js';
import { getRepoInfo, listPullRequests } from './github/pr.js';
import { listIssues } from './jira/client.js';



let command = process.argv[2];
const subcommand = process.argv[3];
const arg = process.argv[4];

const ALIASES = {
  c: 'commit',
  s: 'status',
  m: 'merge',
  b: 'branch',
  p: 'pull',
  u: 'update',
  r: 'review',
  d: 'docs',
  h: 'history',
  i: 'init',
  j: 'jira',
  t: 'today'
};

// Redireciona alias para o comando real
command = ALIASES[command] || command;

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
  } else if (command === 'pull') {
    await runPull();
  } else if (command === 'update') {
    await runUpdate();
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
  } else if (command === 'pr') {
    await handlePrCommand(subcommand, arg);
  } else if (command === 'profile') {
    await handleProfileCommand(subcommand);
  } else if (command === 'jira') {
    await handleJiraCommand(subcommand, arg);
  } else if (command === 'review') {
    const validScopes = ['staged'];
    if (subcommand && !validScopes.includes(subcommand)) {
      warn(`Subcomando '${subcommand}' desconhecido. Usando padrão: todas as alterações.`);
    }
    const scope = subcommand === 'staged' ? 'staged' : 'all';
    await runReviewFlow(scope);
  } else if (command === 'docs') {
    const validTypes = ['changelog'];
    if (subcommand && !validTypes.includes(subcommand)) {
      warn(`Subcomando '${subcommand}' desconhecido. Usando padrão: README.`);
    }
    const type = subcommand === 'changelog' ? 'changelog' : 'readme';
    await runDocsFlow(type);
  } else if (command === 'undo') {
    await runUndo();
  } else if (command === 'today') {
    await runToday();
  } else {
    await showLoading('Inicializando Jarvis', {
      steps: ['Boot', 'Carregando comandos', 'Pronto'],
      durationMs: 800,
    });
    showHelp();
  }
}

// ─── Pull ─────────────────────────────────────────────────

async function runPull() {
  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    process.exit(1);
  }

  const branch = getCurrentBranch();

  if (hasUncommittedChanges()) {
    warn('Existem alterações não commitadas.');
    const proceed = await confirm({
      message: 'Fazer pull mesmo assim? (pode causar conflitos)',
      default: false,
    });
    if (!proceed) {
      info('Pull cancelado.');
      return;
    }
  }

  await showLoading('Atualizando repositório', {
    steps: [`Fetch em ${branch}`, 'Baixando alterações', 'Aplicando'],
    durationMs: 600,
  });

  try {
    const output = execSync('git pull', { encoding: 'utf-8', stdio: 'pipe' });
    success('Repositório atualizado!');
    if (output.trim()) {
      dim(output.trim());
    }
  } catch (err) {
    error(`Falha no pull: ${err.stderr?.trim() || err.message}`);
    process.exit(1);
  }
}

// ─── Update ───────────────────────────────────────────────

async function runUpdate() {
  // Só faz sentido na pasta do Jarvis
  printBanner();
  info('Atualizando o Jarvis...');

  // 1. Pull
  if (isGitRepo()) {
    if (hasUncommittedChanges()) {
      warn('Existem alterações não commitadas no Jarvis.');
      const proceed = await confirm({
        message: 'Continuar mesmo assim?',
        default: false,
      });
      if (!proceed) {
        info('Update cancelado.');
        return;
      }
    }

    await showLoading('Baixando atualizações', {
      steps: ['git pull', 'Verificando dependências'],
      durationMs: 600,
    });

    try {
      execSync('git pull', { encoding: 'utf-8', stdio: 'inherit' });
    } catch (err) {
      error(`Falha no git pull: ${err.stderr?.trim() || err.message}`);
      process.exit(1);
    }
  }

  // 2. npm install
  await showLoading('Instalando dependências', {
    steps: ['npm install', 'Atualizando pacotes'],
    durationMs: 800,
  });

  try {
    execSync('npm install', { encoding: 'utf-8', stdio: 'inherit' });
    success('Jarvis atualizado com sucesso!');
    blank();
    printBox(
      `${chalk.green('jarvis --help')}   veja os comandos disponíveis`,
      { title: ' pronto ' }
    );
  } catch (err) {
    error(`Falha no npm install: ${err.stderr?.trim() || err.message}`);
    process.exit(1);
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

// ─── PR commands ──────────────────────────────────────────

async function handlePrCommand(sub, arg) {
  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    process.exit(1);
  }

  if (!sub || sub === 'list') {
    await prList();
  } else if (sub === 'view') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prView(parseInt(arg));
  } else if (sub === 'diff') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prDiff(parseInt(arg));
  } else if (sub === 'review') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prReview(parseInt(arg));
  } else if (sub === 'checkout') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prCheckout(parseInt(arg));
  } else if (sub === 'approve') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prApprove(parseInt(arg));
  } else if (sub === 'request-changes') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prRequestChanges(parseInt(arg));
  } else if (sub === 'comment') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prComment(parseInt(arg));
  } else if (sub === 'merge') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prMerge(parseInt(arg));
  } else if (sub === 'close') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prClose(parseInt(arg));
  } else {
    error(`Subcomando desconhecido: ${sub}`);
    dim('Use: list, view <n>, diff <n>, review <n>, checkout <n>, approve <n>, request-changes <n>, comment <n>, merge <n>, close <n>');
    process.exit(1);
  }
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

// ─── Profile commands ──────────────────────────────────────

async function handleProfileCommand(sub) {
  if (!sub || sub === 'show') {
    showProfile();
  } else if (sub === 'setup') {
    await setupProfile();
  } else if (sub === 'sync') {
    await syncProfile();
  } else if (sub === 'edit') {
    await editProfile();
  } else if (sub === 'reset') {
    await resetProfile();
  } else {
    error(`Subcomando desconhecido: ${sub}`);
    dim('Use: setup, show, sync, edit, reset');
    process.exit(1);
  }
}

function showProfile() {
  const profile = loadProfile();

  if (!profile) {
    info('Nenhum perfil configurado.');
    dim('Execute: jarvis profile setup');
    return;
  }

  blank();
  const body = [
    `${chalk.bold('Nome')}      ${profile.name || muted('não configurado')}`,
    `${chalk.bold('GitHub')}    ${profile.githubUsername ? accent('@' + profile.githubUsername) : muted('não configurado')}`,
    `${chalk.bold('Assinatura')} ${profile.signatureEnabled ? chalk.green('ativada') : muted('desativada')}`,
    `${chalk.bold('Origem')}    ${profile.source || 'manual'}`,
    `${chalk.bold('Atualizado')} ${profile.updatedAt ? new Date(profile.updatedAt).toLocaleString('pt-BR') : '-'}`,
  ].join('\n');

  printBox(body, { title: 'perfil do jarvis' });
  blank();
}

async function setupProfile() {
  printBanner();
  info('Configuração do perfil do Jarvis');

  let name = null;
  let githubUsername = null;
  let source = 'manual';

  // Tentar GitHub API
  if (GITHUB_TOKEN) {
    const spin = spinner('Procurando informações do desenvolvedor...');
    spin.start();
    try {
      const ghUser = await fetchGitHubUser();
      spin.succeed('Usuário encontrado no GitHub');
      name = ghUser.name;
      githubUsername = ghUser.githubUsername;
      source = 'github';

      blank();
      printBox(
        `${chalk.bold('Nome')}      ${name}\n${chalk.bold('GitHub')}    ${accent('@' + githubUsername)}`,
        { title: 'dados do github' }
      );

      const useGitHub = await confirm({
        message: 'Deseja usar essas informações?',
        default: true,
      });

      if (!useGitHub) {
        name = null;
        githubUsername = null;
        source = 'manual';
      }
    } catch (err) {
      spin.fail('Não foi possível acessar a conta do GitHub.');
      dim('Verifique seu GITHUB_TOKEN e conexão com a internet.');
    }
  }

  // Fallback para git config
  if (!name) {
    info('Tentando usar a configuração do Git...');
    try {
      const gitName = execSync('git config user.name', { encoding: 'utf-8' }).trim();
      const gitEmail = execSync('git config user.email', { encoding: 'utf-8' }).trim();

      if (gitName) {
        blank();
        printBox(
          `${chalk.bold('Nome')}      ${gitName}\n${chalk.bold('Email')}    ${gitEmail}`,
          { title: 'dados do git' }
        );

        const useGit = await confirm({
          message: 'Deseja usar essas informações?',
          default: true,
        });

        if (useGit) {
          name = gitName;
          source = 'git';
        }
      }
    } catch {
      // git config falhou
    }
  }

  // Se nada funcionou, pedir manualmente
  if (!name) {
    warn('Não foi possível identificar o desenvolvedor automaticamente.');
    blank();

    name = await input({
      message: 'Informe seu nome:',
      validate: (v) => v.trim().length > 0 ? true : 'Nome é obrigatório.',
    });

    githubUsername = await input({
      message: 'Informe seu usuário do GitHub (opcional):',
    });
  }

  // Perguntar username se veio do git e não tem
  if (!githubUsername) {
    githubUsername = await input({
      message: 'Informe seu usuário do GitHub (ex: Yurilxm):',
      default: githubUsername || '',
    });
  }

  const profile = {
    name: name.trim(),
    githubUsername: githubUsername.trim() || null,
    signatureEnabled: true,
    source,
  };

  saveProfile(profile);
  success('Perfil salvo com sucesso!');
  showProfile();
}

async function syncProfile() {
  if (!GITHUB_TOKEN) {
    error('GITHUB_TOKEN não configurado. Não é possível sincronizar.');
    return;
  }

  const currentProfile = loadProfile();

  info('Sincronizando perfil com o GitHub...');

  try {
    const ghUser = await fetchGitHubUser();
    const profile = {
      ...(currentProfile || {}),
      name: ghUser.name,
      githubUsername: ghUser.githubUsername,
      source: 'github',
    };
    saveProfile(profile);
    success('Perfil atualizado!');
    showProfile();
  } catch (err) {
    warn('Não foi possível sincronizar com o GitHub.');
    if (currentProfile) {
      dim('O perfil local atual será mantido.');
    }
  }
}

async function editProfile() {
  const current = loadProfile() || {};

  blank();
  const name = await input({
    message: 'Nome:',
    default: current.name || '',
  });

  const githubUsername = await input({
    message: 'GitHub username:',
    default: current.githubUsername || '',
  });

  const sigEnabled = await confirm({
    message: 'Assinatura ativada?',
    default: current.signatureEnabled !== false,
  });

  const profile = {
    ...current,
    name: name.trim(),
    githubUsername: githubUsername.trim() || null,
    signatureEnabled: sigEnabled,
    source: current.source || 'manual',
  };

  saveProfile(profile);
  success('Perfil atualizado!');
  showProfile();
}

async function resetProfile() {
  const current = loadProfile();
  if (!current) {
    info('Nenhum perfil para remover.');
    return;
  }

  warn('Isso removerá o perfil local do Jarvis.');

  const confirmed = await confirm({
    message: 'Deseja continuar?',
    default: false,
  });

  if (!confirmed) {
    info('Cancelado.');
    return;
  }

  deleteProfile();
  success('Perfil removido.');
}

// ─── Jira commands ────────────────────────────────────────

async function handleJiraCommand(sub, issueKey) {
  if (!sub || sub === 'list') {
    const filter = issueKey || 'active';
    await jiraList(filter);
  } else if (sub === 'view') {
    if (!issueKey) { error('Chave da issue é obrigatória.'); process.exit(1); }
    await jiraView(issueKey);
  } else if (sub === 'status') {
    if (!issueKey) { error('Chave da issue é obrigatória.'); process.exit(1); }
    await jiraStatus(issueKey);
  } else if (sub === 'move') {
    if (!issueKey) { error('Chave da issue é obrigatória.'); process.exit(1); }
    await jiraMove(issueKey);
  } else if (sub === 'create') {
    await jiraCreate();
  } else {
    error(`Subcomando desconhecido: ${sub}`);
    dim('Use: list [active|all|done], view <issue>, status <issue>, move <issue>, create');
    process.exit(1);
  }
}

// ─── Undo ─────────────────────────────────────────────────

async function runUndo() {
  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    process.exit(1);
  }

  // Verificar se há commits para desfazer
  let lastCommit;
  try {
    lastCommit = execSync('git log -1 --oneline --no-decorate', { encoding: 'utf-8' }).trim();
  } catch {
    // sem commits
  }

  if (!lastCommit) {
    info('Nenhum commit para desfazer.');
    return;
  }

  blank();
  warn('Último commit:');
  dim(`  ${lastCommit}`);

  const confirmed = await confirm({
    message: 'Desfazer este commit? (git reset --soft HEAD~1)',
    default: false,
  });

  if (!confirmed) {
    info('Undo cancelado.');
    return;
  }

  // Confirmação extra se houver push
  const hasRemote = getPushRemote(getCurrentBranch());
  if (hasRemote) {
    warn('A branch atual tem remote configurado.');
    const pushConfirmed = await confirm({
      message: 'Se você já fez push, desfazer localmente pode causar divergência. Continuar?',
      default: false,
    });

    if (!pushConfirmed) {
      info('Undo cancelado.');
      return;
    }
  }

  try {
    execSync('git reset --soft HEAD~1', { encoding: 'utf-8', stdio: 'inherit' });
    success('Commit desfeito. As alterações estão no staged.');
    dim('Use jarvis commit para commitar novamente quando estiver pronto.');
  } catch (err) {
    error(`Erro ao desfazer commit: ${err.message}`);
    process.exit(1);
  }
}


// ─── Today ─────────────────────────────────────────────────

async function runToday() {
  printBanner();
  info('Preparando seu resumo do dia...\n');

  // ── Status do repositório local ──────────────────────────
  if (isGitRepo()) {
    const branch = getCurrentBranch();
    const status = getGitStatus();
    const total = status.staged.length + status.modified.length + status.deleted.length + status.untracked.length;

    const branchLabel = branch === PROTECTED_BRANCH
      ? chalk.yellow(`${branch} (protegida)`)
      : chalk.green(branch);

    const statusLines = [
      `${chalk.bold('Branch')}  ${branchLabel}`,
      total === 0
        ? `${chalk.bold('Status')}  ${chalk.green('árvore limpa')}`
        : `${chalk.bold('Status')}  ${chalk.yellow(`${total} arquivo(s) alterado(s)`)}`,
    ];

    if (total > 0) {
      if (status.staged.length) {
        statusLines.push(muted('  staged:'));
        for (const f of status.staged) statusLines.push(muted(`    + ${f}`));
      }
      if (status.modified.length) {
        statusLines.push(muted('  modificados:'));
        for (const f of status.modified) statusLines.push(muted(`    ~ ${f}`));
      }
      if (status.untracked.length) {
        statusLines.push(muted('  não rastreados:'));
        for (const f of status.untracked) statusLines.push(muted(`    ? ${f}`));
      }
    }

    printBox(statusLines.join('\n'), { title: 'repositório' });
  } else {
    printBox('Nenhum repositório Git encontrado.', { title: 'repositório' });
  }

  // ── Jira ────────────────────────────────────────────────
  try {
    const projectKey = getProjectConfig('jira.projectKey');
    if (projectKey) {
      const data = await listIssues(projectKey, `project=${projectKey} AND status not in (Done,Closed,Cancelled,Concluído) ORDER BY updated DESC`);
      const issues = data.issues || [];

      if (issues.length === 0) {
        printBox('Nenhuma issue ativa.', { title: 'jira' });
      } else {
        const lines = [];
        for (const issue of issues.slice(0, 10)) {
          const key = issue.key;
          const summary = issue.fields.summary;
          const statusName = issue.fields.status.name;
          const assignee = issue.fields.assignee?.displayName || 'Não atribuído';
          const priority = issue.fields.priority?.name || '-';
          const type = issue.fields.issuetype.name;
          
          const isInProgress = statusName === 'In Progress' || statusName === 'Em andamento';
          const statusColor = isInProgress ? chalk.yellow : (statusName === 'Tarefas pendentes' ? chalk.blue : muted);
          
          lines.push(`${chalk.green(key)}  ${chalk.bold(summary)}`);
          lines.push(muted(`  ${type} · ${statusColor(statusName)} · Prioridade: ${priority} · ${assignee}`));
        }
        if (issues.length > 10) {
          lines.push(muted(`  ... e mais ${issues.length - 10} issue(s)`));
        }
        printBox(lines.join('\n'), { title: `jira · ${issues.length} issue(s) ativa(s)` });
      }
    }
  } catch {
    // Jira não configurado ou erro
  }

  // ── Pull Requests ────────────────────────────────────────
  try {
    const repoInfo = getRepoInfo();
    if (repoInfo.owner && repoInfo.repo && GITHUB_TOKEN) {
      const prs = await listPullRequests(repoInfo.owner, repoInfo.repo);
      if (prs.length === 0) {
        printBox('Nenhuma PR aberta.', { title: 'pull requests' });
      } else {
        const lines = [];
        for (const pr of prs.slice(0, 5)) {
          const hasConflict = pr.mergeable === false;
          const conflictLabel = hasConflict ? chalk.red(' (conflito)') : '';
          lines.push(`${chalk.green(`#${pr.number}`)}  ${chalk.bold(pr.title)}${conflictLabel}`);
          lines.push(muted(`  ${pr.head.ref} → ${pr.base.ref} · por ${pr.user.login}`));
        }
        if (prs.length > 5) {
          lines.push(muted(`  ... e mais ${prs.length - 5} PR(s)`));
        }
        printBox(lines.join('\n'), { title: `pull requests · ${prs.length} aberta(s)` });
      }
    }
  } catch {
    // GitHub não configurado ou erro
  }

  // ── Menu interativo de ações ──────────────────────────────
  blank();
  const action = await select({
    message: 'O que deseja fazer agora?',
    choices: [
      { name: 'Ver status detalhado', value: 'status' },
      { name: 'Commitar alterações', value: 'commit' },
      { name: 'Ver todas as issues no Jira', value: 'jira' },
      { name: 'Ver todas as PRs', value: 'pr' },
      { name: 'Sair', value: 'exit' },
    ],
  });

  if (action === 'exit') return;

  if (action === 'status') showStatus();
  if (action === 'commit') await runCommitFlow();
  if (action === 'jira') await jiraList('active');
  if (action === 'pr') await prList();
}

// ─── Help ─────────────────────────────────────────────────

function showHelp() {
  printBanner();

  const sections = [
    {
      title: 'projeto',
      commands: [
        ['jarvis init', 'Inicializa um repositório Git'],
        ['jarvis status', 'Mostra status do repositório'],
        ['jarvis pull', 'Atualiza a branch atual (git pull)'],
        ['jarvis update', 'Atualiza o Jarvis (pull + npm install)'],
        ['jarvis today', 'Resumo do dia (issues, PRs, status)'],
      ]
    },
    {
      title: 'commit',
      commands: [
        ['jarvis commit', 'Gera mensagem de commit com IA'],
        ['jarvis merge [origem] [destino]', 'Merge entre branches (dev → main)'],
        ['jarvis undo', 'Desfaz o último commit (soft reset)'],
      ]
    },
    {
      title: 'branches',
      commands: [
        ['jarvis branch list', 'Lista branches locais'],
        ['jarvis branch create <nome>', 'Cria uma nova branch'],
        ['jarvis branch switch <nome>', 'Troca para uma branch'],
      ]
    },
    {
      title: 'review & docs',
      commands: [
        ['jarvis review', 'Revisa alterações com IA (somente leitura)'],
        ['jarvis review staged', 'Revisa apenas o que está staged'],
        ['jarvis docs', 'Gera/atualiza README.md com IA'],
        ['jarvis docs changelog', 'Gera/atualiza CHANGELOG.md com IA'],
      ]
    },
    {
      title: 'pull requests',
      commands: [
        ['jarvis pr list', 'Lista PRs abertas'],
        ['jarvis pr view <n>', 'Detalhes de uma PR'],
        ['jarvis pr diff <n>', 'Diff de uma PR'],
        ['jarvis pr review <n>', 'Revisão com IA'],
        ['jarvis pr checkout <n>', 'Checkout da branch da PR'],
        ['jarvis pr approve <n>', 'Aprovar PR'],
        ['jarvis pr merge <n>', 'Fazer merge da PR'],
        ['jarvis pr close <n>', 'Fechar PR sem merge'],
      ]
    },
    {
      title: 'jira',
      commands: [
        ['jarvis jira list [active|all|done]', 'Lista issues (ativas/todas/concluídas)'],
        ['jarvis jira view <issue>', 'Detalhes de uma issue'],
        ['jarvis jira move <issue>', 'Move issue para outro status'],
        ['jarvis jira create', 'Cria nova task (com IA opcional)'],
      ]
    },
    {
      title: 'perfil',
      commands: [
        ['jarvis profile setup', 'Configura perfil do desenvolvedor'],
        ['jarvis profile show', 'Mostra perfil atual'],
        ['jarvis profile edit', 'Edita perfil manualmente'],
      ]
    },
    {
      title: 'outros',
      commands: [
        ['jarvis ignore', 'Gerencia lista de ignore (IA + manual)'],
        ['jarvis history', 'Histórico de commits/pushes do Jarvis'],
      ]
    },
  ];

  for (const section of sections) {
    const body = section.commands
      .map(([cmd, desc]) => `${chalk.green(cmd.padEnd(36))} ${muted(desc)}`)
      .join('\n');
    printBox(body, { title: section.title });
  }

  dim(`  Branch protegida: ${chalk.yellow(PROTECTED_BRANCH)}`);
  dim('  Sem git? Rode jarvis init nesta pasta.');
  blank();
}