/**
 * Intent matcher do Jarvis Voz (fase 3a — simulação).
 * Recebe texto (digitado ou transcrito) e devolve o comando Jarvis correspondente.
 * Sem dependência externa, sem IA — só padrões e normalização.
 */

/**
 * Normaliza texto para comparação: minúsculo, sem acentos, sem pontuação.
 * @param {string} text
 * @returns {string}
 */
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai uma chave de issue do Jira (ex: SDG-71) de um texto.
 * @param {string} text
 * @returns {string|null}
 */
export function extractJiraKey(text) {
  if (!text) return null;
  const m = String(text).match(/\b([A-Z]{2,}-\d+)\b/i);
  return m ? m[1].toUpperCase() : null;
}

// Intents sem argumento.
export const SIMPLE_INTENTS = [
  {
    id: 'today',
    argv: ['today'],
    description: 'Resumo do dia (issues, PRs, status)',
    phrases: [
      'o que eu tenho hoje',
      'o que tenho hoje',
      'o que tenho para hoje',
      'resumo do dia',
      'tarefas de hoje',
      'minhas tarefas',
      'agenda de hoje',
      'agenda do dia',
    ],
    keywords: ['hoje', 'resumo', 'tarefas', 'agenda'],
  },
  {
    id: 'jira-list',
    argv: ['jira', 'list'],
    description: 'Lista de issues ativas do Jira',
    phrases: [
      'lista do jira',
      'lista jira',
      'listar jira',
      'listar issues',
      'listar as issues',
      'listar as tarefas',
      'minhas issues',
      'minhas tarefas do jira',
      'ver issues',
      'issues ativas',
      'ver tarefas',
      'listar tarefas',
      'issues do jira',
      'quais tasks tem no jira',
      'quais tarefas tem no jira',
      'quais issues tem no jira',
      'o que tem no jira',
      'ver o jira',
      'abrir jira',
      'abrir o jira',
      'mostrar jira',
      'mostrar issues',
      'mostrar tarefas',
    ],
    keywords: ['jira', 'issues', 'listar', 'tarefas', 'tasks'],
  },
  {
    id: 'jira-list-done',
    argv: ['jira', 'list', 'done'],
    description: 'Lista de issues concluídas',
    phrases: [
      'issues concluidas',
      'issues finalizadas',
      'jira concluidas',
      'tarefas concluidas',
      'tarefas finalizadas',
      'listar concluidas',
      'issues fechadas',
      'tasks concluidas',
      'tasks finalizadas',
    ],
    keywords: ['concluidas', 'finalizadas', 'done', 'fechadas'],
  },
  {
    id: 'jira-list-all',
    argv: ['jira', 'list', 'all'],
    description: 'Lista de todas as issues',
    phrases: [
      'todas as issues',
      'listar todas',
      'todas as tarefas',
      'todas as tasks',
      'jira completo',
    ],
    keywords: ['todas', 'completo'],
  },
  {
    id: 'status',
    argv: ['status'],
    description: 'Status do repositório atual',
    phrases: [
      'status do repositorio',
      'status do projeto',
      'status do git',
      'como esta o git',
      'como esta o projeto',
      'ver status',
      'status',
    ],
    keywords: ['status', 'repositorio', 'projeto', 'git'],
  },
  {
    id: 'commit',
    argv: ['commit'],
    description: 'Commit assistido com IA',
    phrases: [
      'fazer commit',
      'fazer um commit',
      'novo commit',
      'commitar alteracoes',
      'commitar',
    ],
    keywords: ['commit', 'commitar'],
  },
  {
    id: 'pull',
    argv: ['pull'],
    description: 'Atualiza a branch atual (git pull)',
    phrases: [
      'atualizar repositorio',
      'atualizar projeto',
      'fazer pull',
      'baixar alteracoes',
      'baixar mudancas',
    ],
    keywords: ['pull', 'atualizar', 'baixar'],
  },
  {
    id: 'pr-list',
    argv: ['pr', 'list'],
    description: 'Lista de Pull Requests abertas',
    phrases: [
      'minhas prs',
      'lista de prs',
      'listar prs',
      'ver pull requests',
      'pull requests abertas',
      'minhas pull requests',
    ],
    keywords: ['prs', 'pull', 'requests', 'pr'],
  },
  {
    id: 'branch-list',
    argv: ['branch', 'list'],
    description: 'Lista de branches locais',
    phrases: [
      'listar branches',
      'lista de branches',
      'ver branches',
      'quais branches',
      'minhas branches',
    ],
    keywords: ['branches', 'branch', 'listar'],
  },
  {
    id: 'history',
    argv: ['history'],
    description: 'Histórico de commits/pushes do Jarvis',
    phrases: [
      'historico de commits',
      'ver historico',
      'ultimos commits',
      'historico do jarvis',
      'meu historico',
    ],
    keywords: ['historico', 'commits'],
  },
  {
    id: 'docs-changelog',
    argv: ['docs', 'changelog'],
    description: 'Gera/atualiza CHANGELOG.md',
    phrases: [
      'gerar changelog',
      'atualizar changelog',
      'gerar o changelog',
    ],
    keywords: ['changelog'],
  },
  {
    id: 'docs-readme',
    argv: ['docs'],
    description: 'Gera/atualiza README.md',
    phrases: [
      'gerar documentacao',
      'atualizar readme',
      'gerar readme',
      'documentar projeto',
      'documentar o projeto',
      'atualizar documentacao',
    ],
    keywords: ['documentacao', 'readme', 'documentar'],
  },
  {
    id: 'review',
    argv: ['review'],
    description: 'Revisão de código com IA',
    phrases: [
      'revisar codigo',
      'revisar alteracoes',
      'fazer review',
      'revisao de codigo',
      'revisar o codigo',
    ],
    keywords: ['revisar', 'review', 'revisao'],
  },
  {
    id: 'analyze',
    argv: ['analyze'],
    description: 'Análise de arquitetura do projeto',
    phrases: [
      'analisar projeto',
      'analisar arquitetura',
      'analisar codigo',
      'analisar o projeto',
      'analise de arquitetura',
    ],
    keywords: ['analisar', 'analise', 'arquitetura'],
  },
  {
    id: 'scan',
    argv: ['scan'],
    description: 'Lista projetos Git no workspace',
    phrases: [
      'escanear projetos',
      'listar projetos',
      'projetos disponiveis',
      'ver projetos',
      'quais projetos',
    ],
    keywords: ['projetos', 'escanear', 'scan'],
  },
  {
    id: 'use',
    argv: ['use'],
    description: 'Troca de projeto gerenciado',
    phrases: [
      'trocar projeto',
      'mudar de projeto',
      'selecionar projeto',
      'trocar de projeto',
    ],
    keywords: ['trocar', 'mudar', 'selecionar'],
  },
  {
    id: 'help',
    argv: ['help'],
    description: 'Lista de comandos disponíveis',
    phrases: [
      'o que voce faz',
      'quais comandos',
      'lista de comandos',
      'me ajuda',
      'me ajude',
      'ajuda',
      'comandos',
    ],
    keywords: ['ajuda', 'ajudar', 'comandos', 'menu'],
  },
];

// Intents que exigem argumento (chave de issue do Jira).
// Ordem aqui não importa: o match por frase escolhe sempre a mais longa.
export const ARG_INTENTS = [
  {
    id: 'report',
    argv: ['report'],
    description: 'Relatório de issue (Jira + commits)',
    phrases: [
      'relatorio da task',
      'relatorio da issue',
      'relatorio da tarefa',
      'gerar relatorio',
      'gerar um relatorio',
    ],
    keywords: ['relatorio'],
  },
  {
    id: 'jira-move',
    argv: ['jira', 'move'],
    description: 'Mover issue para outro status',
    phrases: [
      'mover task',
      'mover issue',
      'mover tarefa',
      'mudar status da task',
      'mudar status da issue',
      'mudar status da tarefa',
      'mudar a task de status',
      'status da task',
      'status da issue',
    ],
    keywords: ['mover', 'mudar', 'mover task', 'status'],
  },
  {
    id: 'jira-view',
    argv: ['jira', 'view'],
    description: 'Detalhes de uma issue',
    phrases: [
      'ver task',
      'ver issue',
      'ver tarefa',
      'detalhes da task',
      'detalhes da issue',
      'detalhes da tarefa',
      'abrir task',
      'abrir issue',
      'abrir tarefa',
      'mostrar task',
      'mostrar issue',
      'mostrar tarefa',
    ],
    keywords: ['task', 'issue', 'tarefa', 'detalhes'],
  },
];

const KEYWORD_THRESHOLD = 0.5;

/**
 * Acha a frase mais longa que casa no texto, considerando todos os intents.
 * Frase mais longa = mais específica = vence.
 * @param {string} normalized
 * @param {Array<{id:string,argv:string[],description:string,phrases:string[],keywords:string[]}>} intents
 * @returns {{intent: object, phrase: string, normPhrase: string}|null}
 */
function findLongestPhraseMatch(normalized, intents) {
  let best = null;
  for (const intent of intents) {
    for (const phrase of intent.phrases) {
      const normPhrase = normalize(phrase);
      if (!normPhrase) continue;
      if (!normalized.includes(normPhrase)) continue;
      if (!best || normPhrase.length > best.normPhrase.length) {
        best = { intent, phrase, normPhrase };
      }
    }
  }
  return best;
}

/**
 * Tenta casar keyword (com score acima do threshold) em todos os intents.
 * Em empate, vence o que tiver maior score; depois, o que tiver mais keywords.
 * @param {string} normalized
 * @param {Array} intents
 * @returns {{intent: object, score: number, matchedKws: string[]}|null}
 */
function findBestKeywordMatch(normalized, intents) {
  let best = null;
  for (const intent of intents) {
    const matchedKws = intent.keywords.filter((kw) => normalized.includes(normalize(kw)));
    if (matchedKws.length === 0) continue;
    const score = matchedKws.length / intent.keywords.length;
    if (score < KEYWORD_THRESHOLD) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && matchedKws.length > best.matchedKws.length)
    ) {
      best = { intent, score, matchedKws };
    }
  }
  return best;
}

/**
 * Tenta casar um texto com um intent conhecido.
 * @param {string} rawText
 * @returns {{
 *   intent: string|null,
 *   argv: string[]|null,
 *   confidence: 'high'|'medium'|'low'|'none',
 *   matchedBy?: string,
 *   matched?: string|string[],
 *   arg?: string|null,
 *   description?: string,
 *   reason?: string,
 * }}
 */
export function matchIntent(rawText) {
  if (!rawText || !String(rawText).trim()) {
    return { intent: null, argv: null, confidence: 'none', reason: 'Texto vazio' };
  }

  const text = String(rawText);
  const normalized = normalize(text);
  const jiraKey = extractJiraKey(text);

  // 1. Intents com argumento (quando há chave Jira) — frase mais longa vence
  if (jiraKey) {
    const phraseHit = findLongestPhraseMatch(normalized, ARG_INTENTS);
    if (phraseHit) {
      return {
        intent: phraseHit.intent.id,
        argv: [...phraseHit.intent.argv, jiraKey],
        confidence: 'high',
        matchedBy: 'phrase+arg',
        matched: phraseHit.phrase,
        arg: jiraKey,
        description: phraseHit.intent.description,
      };
    }

    const kwHit = findBestKeywordMatch(normalized, ARG_INTENTS);
    if (kwHit) {
      return {
        intent: kwHit.intent.id,
        argv: [...kwHit.intent.argv, jiraKey],
        confidence: 'medium',
        matchedBy: 'keyword+arg',
        matched: kwHit.matchedKws,
        arg: jiraKey,
        description: kwHit.intent.description,
      };
    }
  }

  // 2. Intents simples — frase mais longa vence
  const phraseHit = findLongestPhraseMatch(normalized, SIMPLE_INTENTS);
  if (phraseHit) {
    return {
      intent: phraseHit.intent.id,
      argv: phraseHit.intent.argv,
      confidence: 'high',
      matchedBy: 'phrase',
      matched: phraseHit.phrase,
      description: phraseHit.intent.description,
    };
  }

  // 3. Intents simples — keyword
  const kwHit = findBestKeywordMatch(normalized, SIMPLE_INTENTS);
  if (kwHit) {
    return {
      intent: kwHit.intent.id,
      argv: kwHit.intent.argv,
      confidence: 'medium',
      matchedBy: 'keyword',
      matched: kwHit.matchedKws,
      description: kwHit.intent.description,
    };
  }

  // 4. Fallback: se só veio uma chave Jira, assume jira-view
  if (jiraKey) {
    return {
      intent: 'jira-view',
      argv: ['jira', 'view', jiraKey],
      confidence: 'low',
      matchedBy: 'arg-only',
      arg: jiraKey,
      description: 'Detalhes de uma issue',
    };
  }

  return {
    intent: null,
    argv: null,
    confidence: 'none',
    reason: 'Nenhum comando reconhecido',
  };
}

/**
 * Lista os intents disponíveis (para help e testes).
 */
export function listIntents() {
  return [
    ...SIMPLE_INTENTS.map((i) => ({
      id: i.id,
      description: i.description,
      argv: i.argv,
      needsArg: false,
    })),
    ...ARG_INTENTS.map((i) => ({
      id: i.id,
      description: i.description,
      argv: i.argv,
      needsArg: true,
    })),
  ];
}