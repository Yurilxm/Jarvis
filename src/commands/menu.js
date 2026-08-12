import { autocomplete, isCancel, cancel, intro, outro, text } from '@clack/prompts';
import { printBanner, printBox, info, dim, blank, chalk, muted } from '../ui.js';
import { getProtectedBranch } from '../config/branches.js';
import { getMenuStyle } from '../config/preferences.js';

/**
 * Catálogo de comandos (execução).
 */
export const COMMAND_CATALOG = [
  { id: 'init', section: 'projeto', label: 'jarvis init', description: 'Inicializa um repositório Git nesta pasta.', keywords: ['git', 'novo'], argv: ['init'] },
  { id: 'status', section: 'projeto', label: 'jarvis status', description: 'Mostra branch e arquivos alterados.', keywords: ['git', 'arquivos'], argv: ['status'] },
  { id: 'pull', section: 'projeto', label: 'jarvis pull', description: 'Atualiza a branch atual (git pull).', keywords: ['git', 'remote'], argv: ['pull'] },
  { id: 'update', section: 'projeto', label: 'jarvis update', description: 'Atualiza o Jarvis (pull + npm install).', keywords: ['upgrade', 'npm'], argv: ['update'] },
  { id: 'config', section: 'projeto', label: 'jarvis config', description: 'Configura o .jarvis-dev.json do projeto.', keywords: ['jira', 'settings'], argv: ['config'] },
  { id: 'today', section: 'projeto', label: 'jarvis today', description: 'Resumo do dia (issues, PRs, status).', keywords: ['resumo', 'dia'], argv: ['today'] },
  { id: 'projects', section: 'projeto', label: 'jarvis projects', description: 'Varre subpastas e lista repositórios Git (raiz continua vinculada).', keywords: ['workspace', 'repos', 'subpastas'], argv: ['projects'] },
  { id: 'use', section: 'projeto', label: 'jarvis use', description: 'Troca para outro projeto gerenciado (abre no terminal).', keywords: ['trocar', 'projeto', 'caminho', 'selecionar'], argv: ['use'] },
  { id: 'add', section: 'projeto', label: 'jarvis add', description: 'Valida a pasta atual e adiciona à lista de projetos gerenciados.', keywords: ['adicionar', 'registrar', 'projeto'], argv: ['add'] },

  { id: 'commit', section: 'commit', label: 'jarvis commit', description: 'Gera mensagem de commit com IA.', keywords: ['ia', 'gemini'], argv: ['commit'] },
  { id: 'merge', section: 'commit', label: 'jarvis merge', description: 'Merge entre branches (dev → main).', keywords: ['git', 'main'], argv: ['merge'] },
  { id: 'undo', section: 'commit', label: 'jarvis undo', description: 'Desfaz o último commit (soft reset).', keywords: ['reset'], argv: ['undo'] },
  { id: 'release', section: 'commit', label: 'jarvis release', description: 'Cria nova versão (tag + push).', keywords: ['tag', 'semver'], argv: ['release'] },

  { id: 'branch-list', section: 'branches', label: 'jarvis branch list', description: 'Lista branches locais.', keywords: ['git'], argv: ['branch', 'list'] },
  { id: 'branch-create', section: 'branches', label: 'jarvis branch create', description: 'Cria uma nova branch.', keywords: ['git', 'nova'], argv: ['branch', 'create'], needsArg: { message: 'Nome da nova branch:', validate: (v) => (v.trim() ? true : 'Informe um nome') } },
  { id: 'branch-switch', section: 'branches', label: 'jarvis branch switch', description: 'Troca para outra branch.', keywords: ['git', 'checkout'], argv: ['branch', 'switch'], needsArg: { message: 'Nome da branch:', validate: (v) => (v.trim() ? true : 'Informe um nome') } },

  { id: 'review', section: 'review & docs', label: 'jarvis review', description: 'Revisa alterações com IA (somente leitura).', keywords: ['ia', 'review'], argv: ['review'] },
  { id: 'review-staged', section: 'review & docs', label: 'jarvis review staged', description: 'Revisa apenas o staging.', keywords: ['ia', 'staged'], argv: ['review', 'staged'] },
  { id: 'docs', section: 'review & docs', label: 'jarvis docs', description: 'Gera/atualiza README.md com IA.', keywords: ['readme'], argv: ['docs'] },
  { id: 'docs-changelog', section: 'review & docs', label: 'jarvis docs changelog', description: 'Gera/atualiza CHANGELOG.md com IA.', keywords: ['changelog'], argv: ['docs', 'changelog'] },
  { id: 'ux', section: 'review & docs', label: 'jarvis ux', description: 'Analisa usabilidade do frontend.', keywords: ['ui'], argv: ['ux'] },
  { id: 'analyze', section: 'review & docs', label: 'jarvis analyze', description: 'Analisa arquitetura do projeto.', keywords: ['arquitetura'], argv: ['analyze'] },
  { id: 'check', section: 'review & docs', label: 'jarvis check', description: 'Verifica vulnerabilidades e segredos.', keywords: ['seguranca', 'audit'], argv: ['check'] },

  { id: 'pr-list', section: 'pull requests', label: 'jarvis pr list', description: 'Lista PRs abertas.', keywords: ['github'], argv: ['pr', 'list'] },
  { id: 'pr-view', section: 'pull requests', label: 'jarvis pr view', description: 'Detalhes de uma PR.', keywords: ['github'], argv: ['pr', 'view'], needsArg: { message: 'Número da PR:', validate: (v) => (/^\d+$/.test(v.trim()) ? true : 'Informe um número') } },
  { id: 'pr-diff', section: 'pull requests', label: 'jarvis pr diff', description: 'Diff de uma PR.', keywords: ['github'], argv: ['pr', 'diff'], needsArg: { message: 'Número da PR:', validate: (v) => (/^\d+$/.test(v.trim()) ? true : 'Informe um número') } },
  { id: 'pr-review', section: 'pull requests', label: 'jarvis pr review', description: 'Revisão de PR com IA.', keywords: ['github', 'ia'], argv: ['pr', 'review'], needsArg: { message: 'Número da PR:', validate: (v) => (/^\d+$/.test(v.trim()) ? true : 'Informe um número') } },
  { id: 'pr-checkout', section: 'pull requests', label: 'jarvis pr checkout', description: 'Checkout da branch da PR.', keywords: ['github'], argv: ['pr', 'checkout'], needsArg: { message: 'Número da PR:', validate: (v) => (/^\d+$/.test(v.trim()) ? true : 'Informe um número') } },
  { id: 'pr-approve', section: 'pull requests', label: 'jarvis pr approve', description: 'Aprovar PR.', keywords: ['github'], argv: ['pr', 'approve'], needsArg: { message: 'Número da PR:', validate: (v) => (/^\d+$/.test(v.trim()) ? true : 'Informe um número') } },
  { id: 'pr-merge', section: 'pull requests', label: 'jarvis pr merge', description: 'Merge de uma PR.', keywords: ['github'], argv: ['pr', 'merge'], needsArg: { message: 'Número da PR:', validate: (v) => (/^\d+$/.test(v.trim()) ? true : 'Informe um número') } },
  { id: 'pr-close', section: 'pull requests', label: 'jarvis pr close', description: 'Fecha PR sem merge.', keywords: ['github'], argv: ['pr', 'close'], needsArg: { message: 'Número da PR:', validate: (v) => (/^\d+$/.test(v.trim()) ? true : 'Informe um número') } },

  { id: 'jira-list', section: 'jira', label: 'jarvis jira list', description: 'Lista issues (ativas por padrão).', keywords: ['issues'], argv: ['jira', 'list'] },
  { id: 'jira-view', section: 'jira', label: 'jarvis jira view', description: 'Detalhes de uma issue.', keywords: ['issue'], argv: ['jira', 'view'], needsArg: { message: 'Chave da issue (ex: SDG-71):', validate: (v) => (v.trim() ? true : 'Informe a chave') } },
  { id: 'jira-move', section: 'jira', label: 'jarvis jira move', description: 'Move issue para outro status.', keywords: ['status'], argv: ['jira', 'move'], needsArg: { message: 'Chave da issue (ex: SDG-71):', validate: (v) => (v.trim() ? true : 'Informe a chave') } },
  { id: 'jira-create', section: 'jira', label: 'jarvis jira create', description: 'Cria nova task (IA opcional).', keywords: ['task'], argv: ['jira', 'create'] },

  { id: 'profile-setup', section: 'perfil', label: 'jarvis profile setup', description: 'Configura perfil do desenvolvedor.', keywords: ['usuario'], argv: ['profile', 'setup'] },
  { id: 'profile-show', section: 'perfil', label: 'jarvis profile show', description: 'Mostra perfil atual.', keywords: ['usuario'], argv: ['profile', 'show'] },
  { id: 'profile-edit', section: 'perfil', label: 'jarvis profile edit', description: 'Edita perfil manualmente.', keywords: ['usuario'], argv: ['profile', 'edit'] },

  { id: 'ignore', section: 'outros', label: 'jarvis ignore', description: 'Gerencia lista de ignore.', keywords: ['segredos'], argv: ['ignore'] },
  { id: 'history', section: 'outros', label: 'jarvis history', description: 'Histórico de commits/pushes do Jarvis.', keywords: ['timeline'], argv: ['history'] },
];

/** Textos curtos para as caixas / hints. */
const SUMMARIES = {
  init: 'Inicializa um repositório Git',
  status: 'Mostra status do repositório',
  pull: 'Atualiza a branch atual (git pull)',
  update: 'Atualiza o Jarvis (pull + npm install)',
  config: 'Configura o .jarvis-dev.json do projeto',
  today: 'Resumo do dia (issues, PRs, status)',
  projects: 'Lista repos Git nas subpastas (até 4 níveis)',
  use: 'Troca para outro projeto gerenciado',
  add: 'Adiciona a pasta atual à lista gerenciada',
  commit: 'Gera mensagem de commit com IA',
  merge: 'Merge entre branches (dev → main)',
  undo: 'Desfaz o último commit (soft reset)',
  release: 'Cria nova versão (tag + push)',
  'branch-list': 'Lista branches locais',
  'branch-create': 'Cria uma nova branch',
  'branch-switch': 'Troca para uma branch',
  review: 'Revisa alterações com IA (somente leitura)',
  'review-staged': 'Revisa apenas o que está staged',
  docs: 'Gera/atualiza README.md com IA',
  'docs-changelog': 'Gera/atualiza CHANGELOG.md com IA',
  ux: 'Analisa usabilidade do frontend (somente leitura)',
  analyze: 'Analisa arquitetura do projeto (somente leitura)',
  check: 'Verifica vulnerabilidades e segredos no código',
  'pr-list': 'Lista PRs abertas',
  'pr-view': 'Detalhes de uma PR',
  'pr-diff': 'Diff de uma PR',
  'pr-review': 'Revisão com IA',
  'pr-checkout': 'Checkout da branch da PR',
  'pr-approve': 'Aprovar PR',
  'pr-merge': 'Fazer merge da PR',
  'pr-close': 'Fechar PR sem merge',
  'jira-list': 'Lista issues (ativas/todas/concluídas)',
  'jira-view': 'Detalhes de uma issue',
  'jira-move': 'Move issue para outro status',
  'jira-create': 'Cria nova task (com IA opcional)',
  'profile-setup': 'Configura perfil do desenvolvedor',
  'profile-show': 'Mostra perfil atual',
  'profile-edit': 'Edita perfil manualmente',
  ignore: 'Gerencia lista de ignore (IA + manual)',
  history: 'Histórico de commits/pushes do Jarvis',
};

const DISPLAY_LABELS = {
  merge: 'jarvis merge [origem] [destino]',
  'branch-create': 'jarvis branch create <nome>',
  'branch-switch': 'jarvis branch switch <nome>',
  'pr-view': 'jarvis pr view <n>',
  'pr-diff': 'jarvis pr diff <n>',
  'pr-review': 'jarvis pr review <n>',
  'pr-checkout': 'jarvis pr checkout <n>',
  'pr-approve': 'jarvis pr approve <n>',
  'pr-merge': 'jarvis pr merge <n>',
  'pr-close': 'jarvis pr close <n>',
  'jira-list': 'jarvis jira list [active|all|done]',
  'jira-view': 'jarvis jira view <issue>',
  'jira-move': 'jarvis jira move <issue>',
  projects: 'jarvis projects [profundidade]',
  add: 'jarvis add [caminho]',
};

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchesEntry(entry, term) {
  if (!term) return true;
  const q = normalize(term).trim();
  if (!q) return true;

  const label = normalize(DISPLAY_LABELS[entry.id] || entry.label);
  const summary = normalize(SUMMARIES[entry.id] || entry.description);
  const section = normalize(entry.section);
  const keywords = (entry.keywords || []).map(normalize);

  const labelTokens = label.split(/[^a-z0-9]+/).filter(Boolean);
  if (labelTokens.some((t) => t.startsWith(q))) return true;
  if (keywords.some((k) => k.startsWith(q) || k.includes(q))) return true;

  if (q.length >= 3) {
    if (section.includes(q)) return true;
    if (summary.includes(q)) return true;
    if (label.includes(q)) return true;
  }

  return q.split(/\s+/).filter(Boolean).every((part) =>
    labelTokens.some((t) => t.startsWith(part)) ||
    keywords.some((k) => k.startsWith(part))
  );
}

function getFilteredEntries(term) {
  return COMMAND_CATALOG.filter((e) => matchesEntry(e, term));
}

export { matchesEntry, getFilteredEntries, normalize };

function buildAutocompleteOptions() {
  const meta = [
    {
      value: '__help_text__',
      label: '⋯ ver catálogo em texto',
      hint: 'Lista todas as seções sem executar',
    },
    {
      value: '__exit__',
      label: '⋯ sair',
      hint: 'Encerra o menu',
    },
  ];

  const commands = COMMAND_CATALOG.map((entry) => ({
    value: entry.id,
    label: `${DISPLAY_LABELS[entry.id] || entry.label}`,
    hint: `${entry.section} · ${SUMMARIES[entry.id] || entry.description}`,
  }));

  return [...meta, ...commands];
}

/**
 * Resolve argv (e pedindo args se necessário) a partir de uma entrada do catálogo.
 * @param {typeof COMMAND_CATALOG[number] | null} entry
 * @returns {Promise<{ argv: string[] } | null>}
 */
async function resolveMenuEntry(entry) {
  if (!entry) {
    info('Menu cancelado.');
    return null;
  }

  printBox(
    `${chalk.bold(DISPLAY_LABELS[entry.id] || entry.label)}\n${muted(SUMMARIES[entry.id] || entry.description)}`,
    { title: entry.section, borderColor: 'green' }
  );

  const argv = [...entry.argv];
  if (entry.needsArg) {
    const value = await text({
      message: entry.needsArg.message,
      initialValue: entry.needsArg.default || '',
      validate: (v) => {
        if (!entry.needsArg.validate) return undefined;
        const result = entry.needsArg.validate(String(v ?? ''));
        if (result === true) return undefined;
        return typeof result === 'string' ? result : 'Valor inválido';
      },
    });

    if (isCancel(value)) {
      cancel('Cancelado.');
      return null;
    }

    argv.push(String(value).trim());
  }

  return { argv };
}

/**
 * Menu interativo via @clack/prompts (autocomplete).
 * Substitui o raw-mode antigo e o search+boxes bugados.
 * @param {'live' | 'classic'} style
 * @returns {Promise<{ argv: string[] } | null>}
 */
async function runClackMenu(style = 'live') {
  printBanner();
  intro(style === 'classic' ? 'Menu clássico' : 'Menu interativo');
  dim(`  Branch protegida: ${chalk.yellow(getProtectedBranch())}`);
  dim('  Digite para filtrar · ↑↓ navega · Enter executa · Esc cancela');
  blank();

  const selectedId = await autocomplete({
    message: 'O que você quer fazer?',
    placeholder: 'commit, jira, pr, use…',
    maxItems: 12,
    options: buildAutocompleteOptions(),
    filter: (searchTerm, option) => {
      if (option.value === '__help_text__' || option.value === '__exit__') {
        if (!searchTerm?.trim()) return true;
        return normalize(option.label).includes(normalize(searchTerm));
      }
      const entry = COMMAND_CATALOG.find((c) => c.id === option.value);
      if (!entry) return false;
      return matchesEntry(entry, searchTerm);
    },
  });

  if (isCancel(selectedId)) {
    cancel('Menu cancelado.');
    return null;
  }

  if (selectedId === '__exit__') {
    outro('Até logo.');
    return null;
  }

  if (selectedId === '__help_text__') {
    outro('Abrindo catálogo…');
    return { argv: ['help-text'] };
  }

  const entry = COMMAND_CATALOG.find((c) => c.id === selectedId) || null;
  if (!entry) {
    cancel('Comando não encontrado.');
    return null;
  }

  outro(DISPLAY_LABELS[entry.id] || entry.label);
  blank();
  return resolveMenuEntry(entry);
}

/**
 * Abre o menu interativo (classic | live → ambos Clack).
 * O modo CLI (`launchMode: commands`) não passa por aqui.
 * @returns {Promise<{ argv: string[] } | null>}
 */
export async function runInteractiveMenu() {
  if (!process.stdin.isTTY) {
    info('Terminal interativo necessário para o menu.');
    dim('Use um comando direto, ex: jarvis status');
    return null;
  }

  const style = getMenuStyle();
  return runClackMenu(style === 'classic' ? 'classic' : 'live');
}

/**
 * Catálogo estático em boxes (ajuda / compatibilidade).
 * Não usa raw mode — seguro no Windows.
 */
export function printCatalogBoxes() {
  printBanner();
  const sections = [];
  for (const entry of COMMAND_CATALOG) {
    let bucket = sections.find((s) => s.title === entry.section);
    if (!bucket) {
      bucket = { title: entry.section, items: [] };
      sections.push(bucket);
    }
    bucket.items.push(entry);
  }

  for (const section of sections) {
    const lines = section.items.map((entry) => {
      const label = DISPLAY_LABELS[entry.id] || entry.label;
      const summary = SUMMARIES[entry.id] || entry.description;
      return `${chalk.green(label.padEnd(36))} ${muted(summary)}`;
    });
    printBox(lines.join('\n'), { title: section.title });
  }

  dim(`  Branch protegida: ${chalk.yellow(getProtectedBranch())}`);
  blank();
}
