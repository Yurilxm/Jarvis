import fs from 'node:fs';
import path from 'node:path';
import { select, confirm, input } from '@inquirer/prompts';
import { discoverProjects, isGitRoot } from '../utils/project-scanner.js';
import { resolveGitProjectRoot } from './add-project.js';
import {
  getWorkspaceRoot,
  setWorkspaceRoot,
  getManagedProjects,
  addManagedProject,
  removeManagedProject,
  isProjectPickerOnLaunch,
  setProjectPickerOnLaunch,
  setLastProjectPath,
  getLastProjectPath,
  getPreferencesPath,
  requestShellCwd,
  clearShellCwdRequest,
  getProjectOpenMode,
} from '../config/preferences.js';
import { openProjectInTerminal } from '../utils/open-terminal.js';
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

/**
 * True se o cwd já é (ou está na raiz de) um projeto Git válido.
 * @param {string} [dir=process.cwd()]
 * @returns {boolean}
 */
export function isAlreadyInProject(dir = process.cwd()) {
  const absolute = path.resolve(dir);
  if (isGitRoot(absolute)) return true;

  const managed = getManagedProjects().some((p) => p.path === absolute);
  if (managed) return true;

  const root = resolveGitProjectRoot(absolute);
  // Só conta como "já no projeto" se estamos na raiz do repo (não numa pasta-pai solta)
  return Boolean(root && root === absolute);
}

/**
 * Monta a lista de projetos gerenciados + descobertos na workspace.
 * @param {string} [launchCwd]
 * @returns {Array<{ name: string, path: string, source: 'managed' | 'discovered' | 'current' }>}
 */
export function listSelectableProjects(launchCwd = process.cwd()) {
  const cwd = path.resolve(launchCwd);
  const workspace = getWorkspaceRoot() || cwd;
  const byPath = new Map();

  for (const p of getManagedProjects()) {
    byPath.set(p.path, { name: p.name, path: p.path, source: 'managed' });
  }

  try {
    const { projects } = discoverProjects(workspace, { maxDepth: 4 });
    for (const p of projects) {
      if (!byPath.has(p.absolutePath)) {
        byPath.set(p.absolutePath, {
          name: p.name,
          path: p.absolutePath,
          source: 'discovered',
        });
      }
    }
  } catch {
    // varredura falhou — segue só com gerenciados
  }

  // Se a pasta atual é um git root e não está na lista, inclui
  if (isGitRoot(cwd) && !byPath.has(cwd)) {
    byPath.set(cwd, {
      name: path.basename(cwd),
      path: cwd,
      source: 'current',
    });
  }

  return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Entra no diretório do projeto (cwd do Node) e abre no terminal conforme preferência.
 * @param {string} projectPath
 * @param {{ remember?: boolean, manage?: boolean }} [options]
 */
export function enterProject(projectPath, { remember = true, manage = true } = {}) {
  const absolute = path.resolve(projectPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Pasta não encontrada: ${absolute}`);
  }
  process.chdir(absolute);
  if (manage) addManagedProject(absolute);
  if (remember) setLastProjectPath(absolute);

  const openMode = getProjectOpenMode();
  let openResult = null;

  if (openMode === 'shell-cd') {
    requestShellCwd(absolute);
  } else if (openMode === 'new-tab' || openMode === 'new-window') {
    clearShellCwdRequest();
    openResult = openProjectInTerminal(absolute, openMode);
  } else {
    clearShellCwdRequest();
  }

  return { absolute, openMode, openResult };
}

/**
 * Picker de projeto.
 * No lançamento (!force): só aparece se a pasta atual NÃO for já um projeto.
 * Com force (jarvis use / menu): sempre pergunta.
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<string|null>}
 */
export async function selectProjectInteractive({ force = false } = {}) {
  if (!force && !isProjectPickerOnLaunch()) return null;
  if (!process.stdin.isTTY) return null;

  const launchCwd = path.resolve(process.cwd());

  // Já está dentro de um projeto → abre o menu direto (troca via jarvis use)
  if (!force && isAlreadyInProject(launchCwd)) {
    addManagedProject(launchCwd);
    setLastProjectPath(launchCwd);
    clearShellCwdRequest();
    return null;
  }

  clearShellCwdRequest();

  const projects = listSelectableProjects(launchCwd);

  // Sem projetos para escolher → segue sem picker
  if (!force && projects.length === 0) return null;

  printBanner();
  const workspace = getWorkspaceRoot() || launchCwd;
  printBox(
    `${chalk.bold('Workspace')}  ${workspace}\n` +
      `${chalk.bold('Atual')}      ${launchCwd}\n` +
      `${muted(`${projects.length} projeto(s) disponíveis`)}`,
    { title: 'selecionar projeto' }
  );

  const last = getLastProjectPath();
  const choices = [
    {
      name: `${chalk.bold('Ficar aqui')} — ${muted(launchCwd)}`,
      value: '__stay__',
      description: 'Continua na pasta atual sem trocar o caminho.',
    },
    ...projects.map((p) => {
      const tag =
        p.source === 'managed' ? chalk.green('gerenciado') :
        p.source === 'discovered' ? chalk.cyan('detectado') :
        muted('atual');
      const mark = last === p.path ? chalk.yellow(' ★') : '';
      return {
        name: `${p.name}${mark}  ${tag}`,
        value: p.path,
        description: p.path,
      };
    }),
    {
      name: muted('⋯ gerenciar lista de projetos'),
      value: '__manage__',
      description: 'Adicionar, remover ou definir a pasta workspace.',
    },
  ];

  let selected;
  try {
    selected = await select({
      message: 'Qual projeto o Jarvis deve gerenciar agora?',
      choices,
      pageSize: Math.min(14, choices.length),
      default: last && projects.some((p) => p.path === last) ? last : '__stay__',
    });
  } catch {
    return null;
  }

  if (selected === '__stay__') {
    clearShellCwdRequest();
    dim(`Continuando em: ${launchCwd}`);
    blank();
    return null;
  }

  if (selected === '__manage__') {
    await manageProjectsInteractive();
    return selectProjectInteractive({ force: true });
  }

  try {
    const { absolute: entered, openMode, openResult } = enterProject(selected);
    success(`Projeto ativo: ${path.basename(entered)}`);
    dim(entered);

    if (openMode === 'new-tab' || openMode === 'new-window') {
      if (openResult?.ok) {
        success(openResult.message);
      } else {
        warn(openResult?.message || 'Não foi possível abrir o terminal.');
      }
    } else if (openMode === 'shell-cd') {
      if (process.env.JARVIS_SHELL_WRAPPER === '1') {
        dim('Ao sair, o terminal atual tenta dar cd (shim PowerShell).');
      } else {
        warn('Modo shell-cd precisa do shim: jarvis shell-setup');
        console.log(chalk.cyan(`  cd '${entered.replace(/'/g, "''")}'`));
      }
    } else {
      dim('Modo none: só o Jarvis mudou de pasta (terminal não abre).');
    }
    blank();
    return entered;
  } catch (err) {
    warn(err.message);
    return null;
  }
}

/**
 * Atalho do boot (respeita preferência projectPickerOnLaunch).
 */
export async function maybeSelectProjectOnLaunch() {
  return selectProjectInteractive({ force: false });
}

/**
 * Fluxo interativo para gerenciar workspace / projetos.
 */
export async function manageProjectsInteractive() {
  while (true) {
    const workspace = getWorkspaceRoot();
    const managed = getManagedProjects();
    const picker = isProjectPickerOnLaunch();

    blank();
    printBox(
      `${chalk.bold('workspaceRoot')}  ${workspace || muted('(cwd no lançamento)')}\n` +
        `${chalk.bold('picker')}         ${picker ? chalk.green('ligado') : muted('desligado')}\n` +
        `${chalk.bold('gerenciados')}    ${managed.length}\n` +
        muted(getPreferencesPath()),
      { title: 'projetos gerenciados' }
    );

    if (managed.length > 0) {
      console.log(
        managed
          .map((p, i) => `  ${chalk.cyan(String(i + 1).padStart(2))}  ${chalk.bold(p.name)}  ${muted(p.path)}`)
          .join('\n')
      );
      blank();
    }

    const action = await select({
      message: 'Gerenciar projetos',
      choices: [
        { name: 'Definir pasta workspace (varredura)', value: 'workspace' },
        { name: 'Limpar pasta workspace', value: 'workspace-clear' },
        { name: 'Adicionar projeto por caminho', value: 'add' },
        { name: 'Detectar e adicionar projetos da workspace', value: 'discover' },
        { name: 'Remover projeto gerenciado', value: 'remove' },
        {
          name: picker
            ? 'Desligar seletor ao abrir o Jarvis'
            : 'Ligar seletor ao abrir o Jarvis',
          value: 'toggle-picker',
        },
        { name: 'Voltar', value: 'back' },
      ],
    });

    if (action === 'back') return;

    if (action === 'toggle-picker') {
      setProjectPickerOnLaunch(!picker);
      success(`Seletor no lançamento: ${!picker ? 'ligado' : 'desligado'}`);
      continue;
    }

    if (action === 'workspace') {
      const value = await input({
        message: 'Caminho da pasta-pai (workspace):',
        default: workspace || process.cwd(),
      });
      const resolved = path.resolve(value.trim());
      if (!fs.existsSync(resolved)) {
        warn('Pasta não existe.');
        continue;
      }
      setWorkspaceRoot(resolved);
      success(`Workspace: ${resolved}`);
      continue;
    }

    if (action === 'workspace-clear') {
      setWorkspaceRoot(null);
      success('Workspace limpa — a varredura usará o cwd.');
      continue;
    }

    if (action === 'add') {
      const value = await input({
        message: 'Caminho do projeto:',
        default: process.cwd(),
      });
      const resolved = path.resolve(value.trim());
      if (!fs.existsSync(resolved)) {
        warn('Pasta não existe.');
        continue;
      }
      addManagedProject(resolved);
      success(`Adicionado: ${path.basename(resolved)}`);
      continue;
    }

    if (action === 'discover') {
      const root = getWorkspaceRoot() || process.cwd();
      const { projects } = discoverProjects(root, { maxDepth: 4 });
      if (projects.length === 0) {
        info('Nenhum repositório Git encontrado.');
        continue;
      }
      const ok = await confirm({
        message: `Adicionar ${projects.length} projeto(s) detectado(s) em ${root}?`,
        default: true,
      });
      if (!ok) continue;
      for (const p of projects) addManagedProject(p.absolutePath, p.name);
      success(`${projects.length} projeto(s) na lista gerenciada.`);
      continue;
    }

    if (action === 'remove') {
      const current = getManagedProjects();
      if (current.length === 0) {
        info('Lista vazia.');
        continue;
      }
      const target = await select({
        message: 'Remover qual?',
        choices: current.map((p) => ({ name: `${p.name} — ${p.path}`, value: p.path })),
      });
      removeManagedProject(target);
      success('Removido da lista gerenciada.');
    }
  }
}
