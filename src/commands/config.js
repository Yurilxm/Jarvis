import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
  getGlobalJiraConfig,
  setGlobalJiraConfig,
} from '../config/preferences.js';
import { manageProjectsInteractive } from './switch-project.js';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  dim,
  blank,
  chalk,
  muted,
} from '../ui.js';
import { isGitRepo } from '../git/status.js';

const OPEN_MODE_LABELS = {
  'new-tab': 'nova aba no Windows Terminal (recomendado)',
  'new-window': 'nova janela do terminal',
  'shell-cd': 'cd no shell atual (shim)',
  none: 'não abre terminal (só cwd do Jarvis)',
};

// ─── Helpers do .env pessoal ──────────────────────────────

function getUserEnvPath() {
  return path.join(os.homedir(), '.jarvis-dev', '.env');
}

function readUserEnv() {
  const envPath = getUserEnvPath();
  const defaults = { geminiKey: '', geminiModel: 'gemini-flash-latest', githubToken: '', jiraDomain: '', jiraEmail: '', jiraToken: '' };
  
  if (!fs.existsSync(envPath)) return defaults;
  
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const result = { ...defaults };
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      
      if (key === 'GEMINI_API_KEY') result.geminiKey = value;
      else if (key === 'GEMINI_MODEL') result.geminiModel = value;
      else if (key === 'GITHUB_TOKEN') result.githubToken = value;
      else if (key === 'JIRA_DOMAIN') result.jiraDomain = value;
      else if (key === 'JIRA_EMAIL') result.jiraEmail = value;
      else if (key === 'JIRA_API_TOKEN') result.jiraToken = value;
    }
    return result;
  } catch {
    return defaults;
  }
}

function saveUserEnv(data) {
  const envPath = getUserEnvPath();
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    try { fs.chmodSync(dir, 0o700); } catch { /* Windows */ }
  }
  
  const content = [
    '# Jarvis Dev — Configuração pessoal',
    '# Gerado por jarvis config',
    `GEMINI_API_KEY=${data.geminiKey || ''}`,
    `GEMINI_MODEL=${data.geminiModel || 'gemini-flash-latest'}`,
    `GITHUB_TOKEN=${data.githubToken || ''}`,
    `JIRA_DOMAIN=${data.jiraDomain || ''}`,
    `JIRA_EMAIL=${data.jiraEmail || ''}`,
    `JIRA_API_TOKEN=${data.jiraToken || ''}`,
    '',
  ].join('\n');
  
  fs.writeFileSync(envPath, content, 'utf-8');
  try { fs.chmodSync(envPath, 0o600); } catch { /* Windows */ }
}

function maskKey(key) {
  if (!key) return muted('não configurada');
  if (key.length <= 8) return '••••••••';
  return key.substring(0, 4) + '••••' + key.substring(key.length - 4);
}

async function setupUserEnv() {
  // Carrega uma vez e mantém o estado durante toda a edição
  const current = readUserEnv();
  
  while (true) {
    const envExists = fs.existsSync(getUserEnvPath());
    
    blank();
    if (envExists) {
      printBox(
        `${chalk.bold('Gemini API Key')}  ${maskKey(current.geminiKey)}\n` +
        `${chalk.bold('Gemini Model')}   ${current.geminiModel || 'gemini-flash-latest'}\n` +
        `${chalk.bold('GitHub Token')}   ${maskKey(current.githubToken)}\n` +
        `${chalk.bold('Jira Domain')}    ${current.jiraDomain || muted('não configurado')}\n` +
        `${chalk.bold('Jira Email')}     ${current.jiraEmail || muted('não configurado')}\n` +
        `${chalk.bold('Jira Token')}     ${maskKey(current.jiraToken)}`,
        { title: 'credenciais atuais' }
      );
    } else {
      info('Nenhum arquivo .env pessoal encontrado.');
      dim('As credenciais serão salvas em ~/.jarvis-dev/.env');
      dim('Este arquivo NÃO é compartilhado e fica protegido na sua pasta pessoal.');
    }
    
    const action = await select({
      message: 'O que deseja fazer?',
      choices: [
        { name: 'Configurar Gemini API Key', value: 'geminiKey' },
        { name: 'Configurar Gemini Model', value: 'geminiModel' },
        { name: 'Configurar GitHub Token', value: 'githubToken' },
        { name: 'Configurar Jira Domain', value: 'jiraDomain' },
        { name: 'Configurar Jira Email', value: 'jiraEmail' },
        { name: 'Configurar Jira API Token', value: 'jiraToken' },
        { name: 'Salvar e sair', value: 'save' },
        { name: 'Sair sem salvar', value: 'exit' },
      ],
    });

    if (action === 'exit') {
      info('Configuração de credenciais cancelada.');
      return;
    }
    
    if (action === 'save') {
      saveUserEnv(current);
      success('Credenciais salvas com sucesso!');
      dim(`Arquivo: ${getUserEnvPath()}`);
      dim('As novas chaves entrarão em vigor na próxima execução do Jarvis.');
      return;
    }
    
    // Editar campo específico
    const fieldLabels = {
      geminiKey: 'Gemini API Key',
      geminiModel: 'Gemini Model',
      githubToken: 'GitHub Token',
      jiraDomain: 'Jira Domain',
      jiraEmail: 'Jira Email',
      jiraToken: 'Jira API Token',
    };
    
    const label = fieldLabels[action];
    const currentValue = current[action] || '';
    
    const newValue = await input({
      message: `${label}:`,
      default: currentValue,
    });
    
    current[action] = newValue.trim();
    // Continua o loop — o current mantém o estado
  }
}

async function setupGlobalJira() {
  const current = getGlobalJiraConfig();

  const projectKey = await input({
    message: 'Jira global — projectKey:',
    default: current.projectKey,
  });
  const projectId = await input({
    message: 'Jira global — projectId:',
    default: current.projectId,
  });
  const issueType = await input({
    message: 'Jira global — issueType:',
    default: current.issueType,
  });

  setGlobalJiraConfig({ projectKey, projectId, issueType });
  success('Configuração global de Jira salva!');
  dim('Agora jarvis jira list funciona de qualquer diretório.');
}

// ─── Comando principal ────────────────────────────────────

export async function runConfig(section) {
  if (section === 'credentials') {
    printBanner();
    await setupUserEnv();
    return;
  }

  printBanner();
  info('Configuração do projeto e preferências\n');

  const isRepo = isGitRepo();
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
      ? 'clássico (Clack autocomplete)'
      : 'interativo (Clack autocomplete)';
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
        ...(isRepo ? [
          { name: 'Jira — projectKey', value: 'jira.projectKey' },
          { name: 'Jira — projectId', value: 'jira.projectId' },
          { name: 'Jira — issueType', value: 'jira.issueType' },
          { name: 'Git — branch protegida', value: 'git.protectedBranch' },
          { name: 'Git — branch de desenvolvimento', value: 'git.developmentBranch' },
        ] : []),
        { name: 'Jira global — configurar fallback para uso fora de projetos', value: 'globalJira' },
        { name: 'UI — ao abrir jarvis (menu ou lista de comandos)', value: 'ui.launchMode' },
        { name: 'UI — ao selecionar projeto (aba / janela / cd)', value: 'ui.projectOpenMode' },
        { name: 'UI — estilo do menu (clássico / ao vivo)', value: 'ui.menuStyle' },
        { name: 'Projetos — workspace e lista gerenciada', value: 'ui.projects' },
        { name: 'Credenciais — configurar .env pessoal (Gemini, GitHub, Jira)', value: 'userEnv' },
        ...(isRepo ? [
          { name: 'Salvar projeto e sair', value: 'save' },
        ] : []),
        { name: 'Sair sem salvar o projeto', value: 'exit' },
      ],
    });

    if (action === 'exit') {
      info('Configuração cancelada.');
      return;
    }

    if (action === 'save') {
      if (!isRepo) {
        warn('Fora de um repositório Git não é possível salvar .jarvis-dev.json.');
        dim('Entre em um projeto Git para salvar a configuração do projeto.');
        continue;
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      success('.jarvis-dev.json salvo com sucesso!');
      blank();
      dim('Este arquivo pode ser commitado no Git (não contém dados sensíveis).');
      dim('Preferências de interface já são salvas automaticamente.');
      return;
    }

    if (action === 'userEnv') {
      await setupUserEnv();
      continue;
    }

    if (action === 'globalJira') {
      await setupGlobalJira();
      continue;
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
            name: 'Interativo — busca Clack (padrão)',
            value: 'live',
            description: 'Autocomplete estável (@clack/prompts).',
          },
          {
            name: 'Clássico — mesma busca Clack (rótulo clássico)',
            value: 'classic',
            description: 'Mesmo motor estável; só muda o texto de intro.',
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