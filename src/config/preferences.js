import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/** @typedef {'live' | 'classic'} MenuStyle */
/** @typedef {'menu' | 'commands'} LaunchMode */
/** @typedef {'new-tab' | 'new-window' | 'shell-cd' | 'none'} ProjectOpenMode */
/** @typedef {{ name: string, path: string }} ManagedProject */

const DEFAULTS = {
  menuStyle: /** @type {MenuStyle} */ ('live'),
  /** Sem argumentos: abrir menu interativo ou só listar comandos CLI. */
  launchMode: /** @type {LaunchMode} */ ('menu'),
  /**
   * Ao selecionar um projeto, como abrir o caminho no terminal.
   * new-tab (padrão): aba no Windows Terminal — confiável, API oficial.
   * new-window: nova janela do Windows Terminal / PowerShell.
   * shell-cd: tenta cd no shell atual via shim (frágil).
   * none: só muda o cwd interno do Jarvis.
   */
  projectOpenMode: /** @type {ProjectOpenMode} */ ('new-tab'),
  /** Pasta-pai para varrer projetos (null = usa o cwd no lançamento). */
  workspaceRoot: /** @type {string|null} */ (null),
  /** Projetos que o Jarvis gerencia (paths absolutos). */
  managedProjects: /** @type {ManagedProject[]} */ ([]),
  /** Ao abrir o menu sem comando, perguntar qual projeto entrar. */
  projectPickerOnLaunch: true,
  /** Último projeto escolhido. */
  lastProjectPath: /** @type {string|null} */ (null),

  // Configuração global do Jira — usada como fallback quando não há .jarvis-dev.json
  jiraProjectKey: '',
  jiraProjectId: '',
  jiraIssueType: 'Tarefa',
};

function getJarvisDir() {
  return path.join(os.homedir(), '.jarvis');
}

function getPrefsPath() {
  return path.join(getJarvisDir(), 'preferences.json');
}

function ensureDir() {
  const dir = getJarvisDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * @returns {typeof DEFAULTS & Record<string, unknown>}
 */
export function loadPreferences() {
  try {
    const prefsPath = getPrefsPath();
    if (!fs.existsSync(prefsPath)) return { ...DEFAULTS, managedProjects: [] };
    const raw = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
    return {
      ...DEFAULTS,
      ...raw,
      managedProjects: Array.isArray(raw.managedProjects) ? raw.managedProjects : [],
    };
  } catch {
    return { ...DEFAULTS, managedProjects: [] };
  }
}

/**
 * @param {Record<string, unknown>} prefs
 */
export function savePreferences(prefs) {
  ensureDir();
  const next = {
    ...loadPreferences(),
    ...prefs,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getPrefsPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

/**
 * @returns {MenuStyle}
 */
export function getMenuStyle() {
  const style = loadPreferences().menuStyle;
  return style === 'classic' ? 'classic' : 'live';
}

/**
 * @param {MenuStyle} style
 */
export function setMenuStyle(style) {
  const menuStyle = style === 'classic' ? 'classic' : 'live';
  return savePreferences({ menuStyle });
}

/**
 * @returns {LaunchMode}
 */
export function getLaunchMode() {
  const mode = loadPreferences().launchMode;
  return mode === 'commands' ? 'commands' : 'menu';
}

/**
 * @param {LaunchMode} mode
 */
export function setLaunchMode(mode) {
  const launchMode = mode === 'commands' ? 'commands' : 'menu';
  return savePreferences({ launchMode });
}

/**
 * @returns {ProjectOpenMode}
 */
export function getProjectOpenMode() {
  const mode = loadPreferences().projectOpenMode;
  if (mode === 'new-window' || mode === 'shell-cd' || mode === 'none') return mode;
  return 'new-tab';
}

/**
 * @param {ProjectOpenMode} mode
 */
export function setProjectOpenMode(mode) {
  const allowed = new Set(['new-tab', 'new-window', 'shell-cd', 'none']);
  const projectOpenMode = allowed.has(mode) ? mode : 'new-tab';
  return savePreferences({ projectOpenMode });
}

export function getPreferencesPath() {
  return getPrefsPath();
}

export function getWorkspaceRoot() {
  const root = loadPreferences().workspaceRoot;
  if (!root || typeof root !== 'string') return null;
  const resolved = path.resolve(root);
  return fs.existsSync(resolved) ? resolved : null;
}

/**
 * @param {string|null} root
 */
export function setWorkspaceRoot(root) {
  if (!root || !String(root).trim()) {
    return savePreferences({ workspaceRoot: null });
  }
  return savePreferences({ workspaceRoot: path.resolve(root.trim()) });
}

export function isProjectPickerOnLaunch() {
  return loadPreferences().projectPickerOnLaunch !== false;
}

/**
 * @param {boolean} enabled
 */
export function setProjectPickerOnLaunch(enabled) {
  return savePreferences({ projectPickerOnLaunch: Boolean(enabled) });
}

/**
 * @returns {ManagedProject[]}
 */
export function getManagedProjects() {
  return loadPreferences()
    .managedProjects
    .map((p) => ({
      name: String(p.name || path.basename(p.path || '')),
      path: path.resolve(String(p.path || '')),
    }))
    .filter((p) => p.path && fs.existsSync(p.path));
}

/**
 * @param {string} projectPath
 * @param {string} [name]
 */
export function addManagedProject(projectPath, name) {
  const absolute = path.resolve(projectPath);
  const projects = getManagedProjects().filter((p) => p.path !== absolute);
  projects.push({
    name: name || path.basename(absolute),
    path: absolute,
  });
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return savePreferences({ managedProjects: projects });
}

/**
 * @param {string} projectPath
 */
export function removeManagedProject(projectPath) {
  const absolute = path.resolve(projectPath);
  const projects = getManagedProjects().filter((p) => p.path !== absolute);
  return savePreferences({ managedProjects: projects });
}

/**
 * @param {string|null} projectPath
 */
export function setLastProjectPath(projectPath) {
  return savePreferences({
    lastProjectPath: projectPath ? path.resolve(projectPath) : null,
  });
}

export function getLastProjectPath() {
  const last = loadPreferences().lastProjectPath;
  if (!last) return null;
  const resolved = path.resolve(last);
  return fs.existsSync(resolved) ? resolved : null;
}

/**
 * Arquivo lido pelo wrapper do shell (PowerShell) para dar cd no terminal pai.
 * @returns {string}
 */
export function getNextCwdPath() {
  return path.join(getJarvisDir(), 'next-cwd');
}

/**
 * Pede ao shell pai para mudar o PWD após o Jarvis encerrar.
 * (process.chdir sozinho não altera o terminal.)
 * @param {string} projectPath
 */
export function requestShellCwd(projectPath) {
  ensureDir();
  fs.writeFileSync(getNextCwdPath(), `${path.resolve(projectPath)}\n`, 'utf-8');
}

/**
 * Remove pedido pendente de cd (ex.: usuário escolheu "ficar aqui").
 */
export function clearShellCwdRequest() {
  try {
    const p = getNextCwdPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

// ─── Configuração global do Jira ─────────────────────────

/**
 * Retorna a configuração global do Jira salva no perfil do usuário.
 * @returns {{ projectKey: string, projectId: string, issueType: string }}
 */
export function getGlobalJiraConfig() {
  const prefs = loadPreferences();
  return {
    projectKey: prefs.jiraProjectKey || '',
    projectId: prefs.jiraProjectId || '',
    issueType: prefs.jiraIssueType || 'Tarefa',
  };
}

/**
 * Salva a configuração global do Jira no perfil do usuário.
 * @param {{ projectKey?: string, projectId?: string, issueType?: string }} config
 */
export function setGlobalJiraConfig({ projectKey, projectId, issueType }) {
  return savePreferences({
    jiraProjectKey: String(projectKey || '').trim(),
    jiraProjectId: String(projectId || '').trim(),
    jiraIssueType: String(issueType || 'Tarefa').trim(),
  });
}