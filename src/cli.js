#!/usr/bin/env node

import { runCommitFlow } from './commit/flow.js';
import { runMergeFlow } from './commit/merge.js';
import { runInitFlow } from './commands/init.js';
import { runPull } from './commands/pull.js';
import { runUpdate } from './commands/update.js';
import { runUndo } from './commands/undo.js';
import { runRelease } from './commands/release.js';
import { runToday } from './commands/today.js';
import { showStatus } from './commands/status.js';
import { handleBranchCommand } from './commands/branch.js';
import { handleProfileCommand } from './commands/profile.js';
import { runConfig } from './commands/config.js';
import { handlePrCommand } from './pr/handler.js';
import { runIgnoreMenu } from './ignore/menu.js';
import { runHistoryView } from './history/view.js';
import { runReviewFlow } from './review/flow.js';
import { runDocsFlow } from './docs/flow.js';
import { handleJiraCommand } from './jira/handler.js';
import { getProtectedBranch } from './config/branches.js';
import { showLoading, warn, printBanner, printBox, muted, chalk, dim, blank } from './ui.js';
import { runAnalyze } from './commands/analyze.js';
import { runUX } from './commands/ux.js';
import { runCheck } from './commands/check.js';
import { showProjects } from './commands/projects.js';
import { maybeSelectProjectOnLaunch, manageProjectsInteractive, selectProjectInteractive } from './commands/switch-project.js';
import { runAddProject } from './commands/add-project.js';
import { runShellSetup } from './commands/shell-setup.js';
import { runInteractiveMenu } from './commands/menu.js';
import { resolveCommand } from './cli-routing.js';
import { getLaunchMode } from './config/preferences.js';

let command = process.argv[2];
let subcommand = process.argv[3];
let arg = process.argv[4];

command = resolveCommand(command);

await bootstrap();

async function bootstrap() {
  const wantsMenu = command === 'menu';
  const wantsHelp = command === 'help';
  const noArgs = !command;

  // Lista de comandos (modo CLI / help explícito)
  if (wantsHelp || (noArgs && getLaunchMode() === 'commands')) {
    showHelpText();
    dim('  Dica: jarvis menu  → abre o menu interativo');
    dim('  Dica: jarvis config → trocar o modo de abertura');
    blank();
    return;
  }

  // Menu interativo (padrão, ou jarvis menu forçado)
  if (wantsMenu || noArgs) {
    await showLoading('Inicializando Jarvis', {
      steps: ['Boot', 'Carregando comandos', 'Pronto'],
      durationMs: 600,
    });
    await maybeSelectProjectOnLaunch();
    const picked = await runInteractiveMenu();
    if (!picked) return;
    if (picked.argv[0] === 'help-text') {
      showHelpText();
      return;
    }
    command = picked.argv[0];
    subcommand = picked.argv[1];
    arg = picked.argv[2];
    command = resolveCommand(command);
  }

  await main();
}

async function main() {
  if (command === 'init') await runInitFlow();
  else if (command === 'ignore') await runIgnoreMenu();
  else if (command === 'history') {
    const pushedOnly = subcommand === '--pushed' || arg === '--pushed';
    const limitArg = [subcommand, arg].find((v) => v && /^\d+$/.test(v));
    await showLoading('Carregando histórico', { steps: ['Lendo .jarvis/history', 'Montando timeline'], durationMs: 450 });
    await runHistoryView({ limit: limitArg ? Number(limitArg) : 30, pushedOnly });
  }
  else if (command === 'commit') await runCommitFlow();
  else if (command === 'merge') {
    await showLoading('Iniciando merge', { steps: ['Verificando branches', 'Preparando merge', 'Pronto'], durationMs: 700 });
    await runMergeFlow(subcommand || null, arg || null);
  }
  else if (command === 'pull') await runPull();
  else if (command === 'update') await runUpdate();
  else if (command === 'status') {
    await showLoading('Lendo repositório', { steps: ['Checando git', 'Coletando status'], durationMs: 500 });
    showStatus();
  }
  else if (command === 'branch') {
    await showLoading('Carregando branches', { steps: ['Lendo refs', 'Montando lista'], durationMs: 450 });
    await handleBranchCommand(subcommand, arg);
  }
  else if (command === 'pr') await handlePrCommand(subcommand, arg);
  else if (command === 'profile') await handleProfileCommand(subcommand);
  else if (command === 'jira') await handleJiraCommand(subcommand, arg);
  else if (command === 'review') {
    const validScopes = ['staged'];
    if (subcommand && !validScopes.includes(subcommand)) warn(`Subcomando '${subcommand}' desconhecido. Usando padrão: todas as alterações.`);
    await runReviewFlow(subcommand === 'staged' ? 'staged' : 'all');
  }
  else if (command === 'docs') {
    const validTypes = ['changelog'];
    if (subcommand && !validTypes.includes(subcommand)) warn(`Subcomando '${subcommand}' desconhecido. Usando padrão: README.`);
    await runDocsFlow(subcommand === 'changelog' ? 'changelog' : 'readme');
  }
  else if (command === 'undo') await runUndo();
  else if (command === 'today') await runToday();
  else if (command === 'release') await runRelease();
  else if (command === 'config') await runConfig(subcommand === 'credentials' ? 'credentials' : undefined);
  else if (command === 'analyze') await runAnalyze();
  else if (command === 'ux') await runUX();
  else if (command === 'check') await runCheck();
  else if (command === 'scan' || command === 'projects' || command === 'workspace') {
    const depthArg = [subcommand, arg].find((v) => v && /^\d+$/.test(v));
    await showLoading('Varrendo subpastas', {
      steps: ['Lendo árvore', 'Detectando repositórios Git', 'Montando lista'],
      durationMs: 500,
    });
    showProjects({ maxDepth: depthArg ? Number(depthArg) : 4 });
  }
  else if (command === 'use' || command === 'switch-project') {
    await selectProjectInteractive({ force: true });
  }
  else if (command === 'add') {
    runAddProject(subcommand || undefined);
  }
  else if (command === 'shell-setup') {
    runShellSetup();
  }
  else if (command === 'setup') {
    // Atalho: setup Windows (policy + shim) via o mesmo script do postinstall
    const { spawnSync } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const pathMod = await import('node:path');
    const setupJs = pathMod.join(pathMod.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'postinstall.js');
    spawnSync(process.execPath, [setupJs], { stdio: 'inherit' });
  }
  else if (command === 'projects-manage') {
    printBanner();
    await manageProjectsInteractive();
  }
  else {
    warn(`Comando desconhecido: ${command}`);
    dim('Rode jarvis sem argumentos para o menu interativo.');
  }
}

function showHelpText() {
  printBanner();
  const sections = [
    { title: 'projeto', commands: [
      ['jarvis init', 'Inicializa um repositório Git'],
      ['jarvis status', 'Mostra status do repositório'],
      ['jarvis pull', 'Atualiza a branch atual (git pull)'],
      ['jarvis update', 'Atualiza o Jarvis (pull + npm install)'],
      ['jarvis config', 'Configura o .jarvis-dev.json do projeto'],
      ['jarvis today', 'Resumo do dia (issues, PRs, status)'],
      ['jarvis scan [n]', 'Varre subpastas e lista repos Git (até n níveis)'],
      ['jarvis use', 'Seleciona um projeto gerenciado e entra na pasta'],
      ['jarvis add [path]', 'Valida a pasta e adiciona à lista gerenciada'],
      ['jarvis shell-setup', 'Instala wrapper PowerShell (cd real no terminal)'],
      ['jarvis setup', 'Setup Windows: libera comando jarvis (sem .cmd)'],
    ]},
    { title: 'commit', commands: [
      ['jarvis commit', 'Gera mensagem de commit com IA'],
      ['jarvis merge [origem] [destino]', 'Merge entre branches (dev → main)'],
      ['jarvis undo', 'Desfaz o último commit (soft reset)'],
      ['jarvis release', 'Cria nova versão (tag + push)'],
    ]},
    { title: 'branches', commands: [
      ['jarvis branch list', 'Lista branches locais'],
      ['jarvis branch create <nome>', 'Cria uma nova branch'],
      ['jarvis branch switch <nome>', 'Troca para uma branch'],
    ]},
    { title: 'review & docs', commands: [
      ['jarvis review', 'Revisa alterações com IA (somente leitura)'],
      ['jarvis review staged', 'Revisa apenas o que está staged'],
      ['jarvis docs', 'Gera/atualiza README.md com IA'],
      ['jarvis docs changelog', 'Gera/atualiza CHANGELOG.md com IA'],
      ['jarvis ux', 'Analisa usabilidade do frontend (somente leitura)'],
      ['jarvis analyze', 'Analisa arquitetura do projeto (somente leitura)'],
      ['jarvis check', 'Verifica vulnerabilidades e segredos no código'],
    ]},
    { title: 'pull requests', commands: [
      ['jarvis pr list', 'Lista PRs abertas'],
      ['jarvis pr view <n>', 'Detalhes de uma PR'],
      ['jarvis pr diff <n>', 'Diff de uma PR'],
      ['jarvis pr review <n>', 'Revisão com IA'],
      ['jarvis pr checkout <n>', 'Checkout da branch da PR'],
      ['jarvis pr approve <n>', 'Aprovar PR'],
      ['jarvis pr merge <n>', 'Fazer merge da PR'],
      ['jarvis pr close <n>', 'Fechar PR sem merge'],
    ]},
    { title: 'jira', commands: [
      ['jarvis jira list [active|all|done]', 'Lista issues (ativas/todas/concluídas)'],
      ['jarvis jira view <issue>', 'Detalhes de uma issue'],
      ['jarvis jira move <issue>', 'Move issue para outro status'],
      ['jarvis jira create', 'Cria nova task (com IA opcional)'],
    ]},
    { title: 'perfil', commands: [
      ['jarvis profile setup', 'Configura perfil do desenvolvedor'],
      ['jarvis profile show', 'Mostra perfil atual'],
      ['jarvis profile edit', 'Edita perfil manualmente'],
    ]},
    { title: 'outros', commands: [
      ['jarvis ignore', 'Gerencia lista de ignore (IA + manual)'],
      ['jarvis history', 'Histórico de commits/pushes do Jarvis'],
    ]},
  ];
  for (const section of sections) {
    const body = section.commands.map(([cmd, desc]) => `${chalk.green(cmd.padEnd(36))} ${muted(desc)}`).join('\n');
    printBox(body, { title: section.title });
  }
  dim(`  Branch protegida: ${chalk.yellow(getProtectedBranch())}`);
  dim('  Dica: rode jarvis sem argumentos para o menu com busca.');
  blank();
}
