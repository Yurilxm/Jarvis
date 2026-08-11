import fs from 'node:fs';
import path from 'node:path';
import { input, select } from '@inquirer/prompts';
import {
  getMenuStyle,
  setMenuStyle,
  getLaunchMode,
  setLaunchMode,
  getProjectOpenMode,
  setProjectOpenMode,
  getPreferencesPath,
  getManagedProjects,
  getWorkspaceRoot,
  isProjectPickerOnLaunch,
} from '../config/preferences.js';
import { manageProjectsInteractive } from './switch-project.js';
import {
  printBanner,
  printBox,
  info,
  success,
  dim,
  blank,
  chalk,
  muted,
} from '../ui.js';

const OPEN_MODE_LABELS = {
  'new-tab': 'nova aba no Windows Terminal (recomendado)',
  'new-window': 'nova janela do terminal',
  'shell-cd': 'cd no shell atual (shim)',
  none: 'não abre terminal (só cwd do Jarvis)',
};

export async function runConfig() {
  printBanner();
  info('Configuração do projeto e preferências\n');

  const cwd = process.cwd();
  const configPath = path.join(cwd, '.jarvis-dev.json');

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      // inválido, começar vazio
    }
  }

  config.jira = config.jira || {};
  config.git = config.git || {};

  while (true) {
    const menuStyle = getMenuStyle();
    const menuLabel = menuStyle === 'classic'
      ? 'clássico (busca + caixas estáticas)'
      : 'ao vivo (filtra as boxes ao digitar)';
    const launchMode = getLaunchMode();
    const launchLabel = launchMode === 'commands'
      ? 'só lista os comandos (CLI)'
      : 'abre o menu interativo';
    const openMode = getProjectOpenMode();

    const currentJira = [
      `${chalk.bold('projectKey')}  ${config.jira.projectKey || muted('não configurado')}`,
      `${chalk.bold('projectId')}  ${config.jira.projectId || muted('não configurado')}`,
      `${chalk.bold('issueType')}  ${config.jira.issueType || muted('não configurado')}`,
    ].join('\n');

    const currentGit = [
      `${chalk.bold('protectedBranch')}      ${config.git.protectedBranch || muted('não configurado')}`,
      `${chalk.bold('developmentBranch')}    ${config.git.developmentBranch || muted('não configurado')}`,
    ].join('\n');

    const managed = getManagedProjects();
    const workspace = getWorkspaceRoot();
    const picker = isProjectPickerOnLaunch();

    const currentUi = [
      `${chalk.bold('launchMode')}       ${chalk.cyan(launchMode)} — ${muted(launchLabel)}`,
      `${chalk.bold('projectOpenMode')}  ${chalk.cyan(openMode)} — ${muted(OPEN_MODE_LABELS[openMode])}`,
      `${chalk.bold('menuStyle')}        ${chalk.cyan(menuStyle)} — ${muted(menuLabel)}`,
      `${chalk.bold('picker')}           ${picker ? chalk.green('ligado') : muted('desligado')} no lançamento`,
      `${chalk.bold('workspace')}        ${workspace || muted('(cwd)')}`,
      `${chalk.bold('projetos')}         ${managed.length} gerenciado(s)`,
      muted(`salvo em ${getPreferencesPath()}`),
    ].join('\n');

    blank();
    printBox(currentJira, { title: 'jira' });
    printBox(currentGit, { title: 'git' });
    printBox(currentUi, { title: 'interface (global)' });

    const action = await select({
      message: 'O que deseja configurar?',
      choices: [
        { name: 'Jira — projectKey', value: 'jira.projectKey' },
        { name: 'Jira — projectId', value: 'jira.projectId' },
        { name: 'Jira — issueType', value: 'jira.issueType' },
        { name: 'Git — branch protegida', value: 'git.protectedBranch' },
        { name: 'Git — branch de desenvolvimento', value: 'git.developmentBranch' },
        { name: 'UI — ao abrir jarvis (menu ou lista de comandos)', value: 'ui.launchMode' },
        { name: 'UI — ao selecionar projeto (aba / janela / cd)', value: 'ui.projectOpenMode' },
        { name: 'UI — estilo do menu (clássico / ao vivo)', value: 'ui.menuStyle' },
        { name: 'Projetos — workspace e lista gerenciada', value: 'ui.projects' },
        { name: 'Salvar projeto e sair', value: 'save' },
        { name: 'Sair sem salvar o projeto', value: 'exit' },
      ],
    });

    if (action === 'exit') {
      info('Configuração cancelada.');
      return;
    }

    if (action === 'save') {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      success('.jarvis-dev.json salvo com sucesso!');
      blank();
      dim('Este arquivo pode ser commitado no Git (não contém dados sensíveis).');
      dim('Preferências de interface já são salvas automaticamente.');
      return;
    }

    if (action === 'ui.launchMode') {
      const next = await select({
        message: 'Ao chamar jarvis sem argumentos, o que deve acontecer?',
        choices: [
          {
            name: 'Abrir o menu interativo (padrão)',
            value: 'menu',
            description: 'Seletor de projeto (se ligado) + menu para escolher o comando.',
          },
          {
            name: 'Só mostrar a lista de comandos (modo CLI)',
            value: 'commands',
            description: 'Exibe o catálogo e encerra — você digita jarvis <comando> depois.',
          },
        ],
        default: launchMode,
      });

      setLaunchMode(next);
      success(`Abertura do Jarvis: ${next === 'commands' ? 'lista de comandos' : 'menu interativo'}`);
      continue;
    }

    if (action === 'ui.projectOpenMode') {
      const next = await select({
        message: 'Ao selecionar um projeto, como abrir o caminho?',
        choices: [
          {
            name: 'Nova aba no Windows Terminal (recomendado)',
            value: 'new-tab',
            description: 'API oficial do wt.exe — funciona com jarvis.cmd e jarvis.',
          },
          {
            name: 'Nova janela do terminal',
            value: 'new-window',
            description: 'Abre outra janela do Windows Terminal (ou PowerShell).',
          },
          {
            name: 'cd no shell atual (shim PowerShell)',
            value: 'shell-cd',
            description: 'Tenta mudar o pwd desta aba — exige shim e é mais frágil.',
          },
          {
            name: 'Não abrir terminal',
            value: 'none',
            description: 'Só o processo do Jarvis muda de pasta.',
          },
        ],
        default: openMode,
      });

      setProjectOpenMode(next);
      success(`Abrir projeto: ${OPEN_MODE_LABELS[next]}`);
      continue;
    }

    if (action === 'ui.menuStyle') {
      const next = await select({
        message: 'Como prefere navegar no menu do Jarvis?',
        choices: [
          {
            name: 'Ao vivo — boxes filtram enquanto digita (padrão)',
            value: 'live',
            description: 'Menu atual com redraw e filtro em tempo real.',
          },
          {
            name: 'Clássico — caixas estáticas + busca com setas',
            value: 'classic',
            description: 'Estilo antigo: catálogo fixo e search do Inquirer.',
          },
        ],
        default: menuStyle,
      });

      setMenuStyle(next);
      success(`Estilo do menu: ${next === 'classic' ? 'clássico' : 'ao vivo'}`);
      continue;
    }

    if (action === 'ui.projects') {
      await manageProjectsInteractive();
      continue;
    }

    const [section, key] = action.split('.');
    const currentValue = config[section][key] || '';

    const newValue = await input({
      message: `${action}:`,
      default: currentValue,
    });

    config[section][key] = newValue.trim() || undefined;
    if (!newValue.trim()) delete config[section][key];
  }
}
