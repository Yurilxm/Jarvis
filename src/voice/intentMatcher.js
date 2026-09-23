/**
 * Remove o prefixo "Jarvis" (e variações) do começo do texto.
 * @param {string} text
 * @returns {string}
 */
export function stripWakeWord(text) {
  if (!text) return '';
  return String(text)
    .replace(/^(ei\s+|ok\s+|oi\s+|hey\s+)?jarvis[\s,.:!?]+/i, '')
    .trim();
}

/**
 * Remove cortesias e verbos de pedido que não agregam ao match.
 * Ex: "por favor, me manda a lista do jira" → "lista do jira"
 * @param {string} text
 * @returns {string}
 */
export function stripPoliteness(text) {
  if (!text) return '';
  let out = String(text);

  // Cortesias no início e fim
  out = out.replace(/^(por favor|por gentileza|por obséquio|por favor,|por gentileza,)[\s,]+/i, '');
  out = out.replace(/[\s,]+(por favor|por gentileza|por obséquio|obrigado|obrigada|valeu|vlw)[.!?]?$/i, '');

  // Verbos de pedido no início
  const politePatterns = [
    /^(tem como|tem como você|será que|sera que|você pode|voce pode|você consegue|voce consegue|dá pra|da pra|dá para|da para|consegue|consegues)\s+/i,
    /^(queria que você|queria que voce|quero que você|quero que voce|preciso que você|preciso que voce|gostaria que você|gostaria que voce)\s+/i,
    /^(me manda|me mandar|me mande|me mandasse|me manda ai|me mostra|me mostrar|me mostre|me mostrasse|me diz|me dizer|me diga|me fala|me falar|me fale|me traz|me trazer|me traga|me passa|me passar|me passe|me envie|me enviar|me enviasse|me lista|me listar|me liste|me listasse|me dá|me dar|me dê|me desse|me daria)\s+/i,
    /^(pode me|pode mandar|pode mostrar|pode dizer|pode falar|pode listar|pode passar)\s+/i,
    /^(me ajuda a|me ajude a|me auxilia a)\s+/i,
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const re of politePatterns) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }

  // Cortesias no fim (após verbos de pedido)
  out = out.replace(/[\s,]+(pra mim|para mim|aí|ai|então|entao)[.!?]?$/i, '');

  return out.trim();
}

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
      'meu resumo',
      'o que eu tenho hoje',
      'o que tenho hoje',
      'o que tenho para hoje',
      'o que tem para hoje',
      'o que tem pra hoje',
      'resumo do dia',
      'resumo de hoje',
      'minha agenda',
      'agenda de hoje',
      'agenda do dia',
      'tarefas de hoje',
      'tarefas do dia',
      'minhas tarefas',
      'minhas tarefas de hoje',
      'minhas atividades',
      'o que preciso fazer hoje',
      'o que devo fazer hoje',
      'meu dia',
    ],
    keywords: ['hoje', 'agenda', 'resumo'],
    context: ['tarefas', 'tarefa', 'atividades', 'dia'],
  },
  {
    id: 'jira-list',
    argv: ['jira', 'list'],
    description: 'Lista de issues ativas do Jira',
    phrases: [
      'lista do jira',
      'lista jira',
      'lista das tasks',
      'lista das tarefas',
      'lista das issues',
      'lista de tasks',
      'lista de tarefas',
      'lista de issues',
      'lista completa das tasks',
      'lista completa das tarefas',
      'lista completa do jira',
      'lista completa de tasks',
      'lista completa de tarefas',
      'listar jira',
      'listar issues',
      'listar tasks',
      'listar tarefas',
      'listar as issues',
      'listar as tarefas',
      'listar as tasks',
      'minhas issues',
      'minhas tasks',
      'minhas tarefas',
      'minhas tarefas do jira',
      'ver issues',
      'ver tasks',
      'ver tarefas',
      'issues do jira',
      'tasks do jira',
      'tarefas do jira',
      'issues ativas',
      'tasks ativas',
      'tarefas ativas',
      'quais tasks tem no jira',
      'quais tarefas tem no jira',
      'quais issues tem no jira',
      'quais sao minhas tasks',
      'quais sao minhas tarefas',
      'quais sao minhas issues',
      'o que tem no jira',
      'o que tem de tarefa',
      'o que tem de issue',
      'ver o jira',
      'abrir jira',
      'abrir o jira',
      'mostrar jira',
      'mostrar issues',
      'mostrar tasks',
      'mostrar tarefas',
      'as tasks do jira',
      'as tarefas do jira',
      'as issues do jira',
      'me mostra as issues',
      'me mostra as tarefas',
      'mostra as issues',
      'mostra as tarefas',
      'ver minhas issues',
      'ver minhas tarefas',
      'o que tem de tarefa no jira',
      'o que tem de issue no jira',
    ],
    keywords: ['jira', 'tasks', 'tarefas', 'issues'],
    context: ['lista', 'listar', 'cards', 'todas', 'completa'],
  },
  {
    id: 'jira-list-done',
    argv: ['jira', 'list', 'done'],
    description: 'Lista de issues concluídas',
    phrases: [
      'issues concluidas',
      'issues finalizadas',
      'issues fechadas',
      'jira concluidas',
      'jira finalizadas',
      'tasks concluidas',
      'tasks finalizadas',
      'tarefas concluidas',
      'tarefas finalizadas',
      'listar concluidas',
      'listar finalizadas',
      'concluidas do jira',
      'finalizadas do jira',
    ],
    keywords: ['concluidas', 'finalizadas', 'fechadas', 'done', 'terminadas'],
    context: ['jira', 'tasks', 'tarefas', 'issues'],
  },
  {
    id: 'jira-list-all',
    argv: ['jira', 'list', 'all'],
    description: 'Lista de todas as issues',
    phrases: [
      'todas as issues',
      'todas as tasks',
      'todas as tarefas',
      'todas do jira',
      'listar todas',
      'listar tudo',
      'jira completo',
      'tudo do jira',
    ],
    keywords: ['todas', 'todos', 'tudo', 'completo'],
    context: ['jira', 'tasks', 'tarefas', 'issues'],
  },
  {
    id: 'status',
    argv: ['status'],
    description: 'Status do repositório atual',
    phrases: [
      'status do repositorio',
      'status do projeto',
      'status do git',
      'status do codigo',
      'status',
      'como esta o git',
      'como esta o projeto',
      'como esta o repositorio',
      'como esta o codigo',
      'como ta o repositorio',
      'como ta o projeto',
      'como ta o git',
      'situacao do projeto',
      'situacao do repositorio',
      'ver status',
      'mostrar status',
      'git status',
      'roda status'
    ],
    keywords: ['status', 'situacao'],
    context: ['projeto', 'repositorio', 'git', 'codigo'],
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
      'commitar as alteracoes',
      'commitar mudancas',
      'salvar alteracoes',
      'salvar mudancas',
      'commitar',
      'quero commitar',
      'preciso commitar',
    ],
    keywords: ['commit', 'commitar'],
    context: ['fazer', 'faz', 'faça', 'faca', 'novo', 'alteracoes', 'mudancas'],
  },
  {
    id: 'pull',
    argv: ['pull'],
    description: 'Atualiza a branch atual (git pull)',
    phrases: [
      'atualizar repositorio',
      'atualizar projeto',
      'atualiza o projeto',
      'atualiza o repositorio',
      'atualiza o repo',
      'atualizar o projeto',
      'atualizar o repositorio',
      'fazer pull',
      'fazer um pull',
      'baixar alteracoes',
      'baixar mudancas',
      'puxar alteracoes',
      'puxar do remoto',
      'git pull',
    ],
    keywords: ['pull'],
    context: ['atualizar', 'atualiza', 'atualize', 'baixar', 'baixa', 'puxar', 'puxa'],
  },
  {
    id: 'pr-list',
    argv: ['pr', 'list'],
    description: 'Lista de Pull Requests abertas',
    phrases: [
      'minhas prs',
      'minhas pull requests',
      'lista de prs',
      'lista de pull requests',
      'listar prs',
      'listar pull requests',
      'ver prs',
      'ver pull requests',
      'pull requests abertas',
      'prs abertas',
      'prs do github',
      'pull requests do github',
    ],
    keywords: ['prs', 'pull requests', 'pr'],
    context: ['lista', 'listar', 'abertas', 'github'],
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
      'branches locais',
    ],
    keywords: ['branches', 'branch'],
    context: ['listar', 'lista', 'listas', 'minhas', 'quais', 'tenho'],
  },
  {
    id: 'history',
    argv: ['history'],
    description: 'Histórico de commits/pushes do Jarvis',
    phrases: [
      'historico de commits',
      'historico de pushes',
      'historico do jarvis',
      'historico de eventos',
      'ver historico',
      'mostrar historico',
      'meu historico',
      'ultimos commits',
      'ultimos eventos',
    ],
    keywords: ['historico'],
    context: ['commits', 'pushes', 'eventos', 'ultimos', 'ver', 'mostrar', 'quero'],
  },
  {
    id: 'docs-changelog',
    argv: ['docs', 'changelog'],
    description: 'Gera/atualiza CHANGELOG.md',
    phrases: [
      'gerar changelog',
      'gerar o changelog',
      'atualizar changelog',
      'atualizar o changelog',
      'criar changelog',
      'changelog',
    ],
    keywords: ['changelog'],
    context: ['gerar', 'gera', 'atualizar', 'atualiza', 'criar', 'cria'],
  },
  {
    id: 'docs-readme',
    argv: ['docs'],
    description: 'Gera/atualiza README.md',
    phrases: [
      'gerar documentacao',
      'gerar readme',
      'gerar o readme',
      'atualizar documentacao',
      'atualizar readme',
      'atualizar o readme',
      'documentar projeto',
      'documentar o projeto',
      'criar readme',
      'criar documentacao',
    ],
    keywords: ['readme', 'documentacao'],
    context: ['gerar', 'gera', 'atualizar', 'atualiza', 'criar', 'cria', 'documentar', 'documenta'],
  },
  {
    id: 'review',
    argv: ['review'],
    description: 'Revisão de código com IA',
    phrases: [
      'revisar codigo',
      'revisar o codigo',
      'revisar alteracoes',
      'revisar as alteracoes',
      'fazer review',
      'fazer um review',
      'revisao de codigo',
      'code review',
    ],
    keywords: ['revisar', 'review', 'revisao'],
    context: ['codigo', 'alteracoes', 'faz', 'faca', 'faça'],
  },
  {
    id: 'analyze',
    argv: ['analyze'],
    description: 'Análise de arquitetura do projeto',
    phrases: [
      'analisar projeto',
      'analisar o projeto',
      'analisar arquitetura',
      'analisar o codigo',
      'analisar codigo',
      'analise de arquitetura',
      'analise do projeto',
      'analise do codigo',
    ],
    keywords: ['analisar', 'analise'],
    context: ['projeto', 'arquitetura', 'codigo'],
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
      'meus projetos',
      'meus repositorios',
      'listar repositorios',
    ],
    keywords: ['projetos', 'repositorios', 'repos'],
    context: ['listar', 'lista', 'escanear', 'escaneia', 'disponiveis', 'quais', 'meus'],
  },
  {
    id: 'use',
    argv: ['use'],
    description: 'Troca de projeto gerenciado',
    phrases: [
      'trocar projeto',
      'trocar de projeto',
      'mudar de projeto',
      'mudar projeto',
      'selecionar projeto',
      'selecionar outro projeto',
      'entrar em outro projeto',
    ],
    keywords: ['trocar', 'mudar', 'selecionar'],
    context: ['projeto'],
  },
  {
    id: 'help',
    argv: ['help'],
    description: 'Lista de comandos disponíveis',
    phrases: [
      'o que voce faz',
      'o que voce pode fazer',
      'quais comandos',
      'quais sao os comandos',
      'lista de comandos',
      'me ajuda',
      'me ajude',
      'preciso de ajuda',
      'ajuda',
      'comandos',
    ],
    keywords: ['ajuda', 'ajudar', 'comandos', 'menu'],
    context: ['voce', 'faz', 'pode', 'quais'],
  },
];

// Intents que exigem argumento (chave de issue do Jira).
export const ARG_INTENTS = [
  {
    id: 'report',
    argv: ['report'],
    description: 'Relatório de issue (Jira + commits)',
    phrases: [
      'relatorio da task',
      'relatorio da issue',
      'relatorio da tarefa',
      'relatorio do',
      'relatorio de',
      'gerar relatorio',
      'gerar um relatorio',
      'fazer relatorio',
      'criar relatorio',
      'relatorio',
    ],
    keywords: ['relatorio'],
    context: ['task', 'issue', 'tarefa', 'gerar', 'criar'],
  },
  {
    id: 'jira-move',
    argv: ['jira', 'move'],
    description: 'Mover issue para outro status',
    phrases: [
      'mover task',
      'mover a task',
      'mover issue',
      'mover a issue',
      'mover tarefa',
      'mover a tarefa',
      'mudar status da task',
      'mudar status da issue',
      'mudar status da tarefa',
      'mudar status',
      'mudar a task de status',
      'alterar status',
      'status da task',
      'status da issue',
      'status da tarefa',
    ],
    keywords: ['mover', 'mudar', 'alterar'],
    context: ['task', 'issue', 'tarefa', 'status'],
  },
  {
    id: 'jira-view',
    argv: ['jira', 'view'],
    description: 'Detalhes de uma issue',
    phrases: [
      'ver task',
      'ver a task',
      'ver issue',
      'ver a issue',
      'ver tarefa',
      'ver a tarefa',
      'detalhes da task',
      'detalhes da issue',
      'detalhes da tarefa',
      'abrir task',
      'abrir issue',
      'abrir tarefa',
      'mostrar task',
      'mostrar issue',
      'mostrar tarefa',
      'detalhes do',
      'detalhes de',
    ],
    keywords: ['detalhes'],
    context: ['task', 'issue', 'tarefa', 'ver', 'abrir', 'mostrar'],
  },
];

const KEYWORD_THRESHOLD = 0.24;
const CONTEXT_BONUS = 0.5;

/**
 * Acha a frase mais longa que casa no texto.
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
 * Conta quantos itens de uma lista estão no texto normalizado.
 */
function countMatches(normalized, items) {
  if (!items || items.length === 0) return 0;
  return items.filter((item) => normalized.includes(normalize(item))).length;
}

/**
 * Tenta casar keywords + context em todos os intents.
 * - keywords: obrigatórias (peso alto)
 * - context: dão bônus
 */
function findBestKeywordMatch(normalized, intents) {
  let best = null;
  for (const intent of intents) {
    const kwTotal = intent.keywords?.length || 0;
    if (kwTotal === 0) continue;

    const kwHits = countMatches(normalized, intent.keywords);
    if (kwHits === 0) continue;

    const kwScore = kwHits / kwTotal;

    // Score base
    let score = kwScore;

    // Bônus por context (até CONTEXT_BONUS)
    const ctxTotal = intent.context?.length || 0;
    if (ctxTotal > 0) {
      const ctxHits = countMatches(normalized, intent.context);
      if (ctxHits > 0) {
        score += CONTEXT_BONUS * (ctxHits / ctxTotal);
      }
    }

    if (
      !best ||
      score > best.score ||
      (score === best.score && kwHits > best.kwHits)
    ) {
      best = { intent, score, kwHits, matchedKws: intent.keywords.filter((kw) => normalized.includes(normalize(kw))) };
    }
  }
  return best;
}

/**
 * Tenta casar um texto com um intent conhecido.
 */
export function matchIntent(rawText) {
  if (!rawText || !String(rawText).trim()) {
    return { intent: null, argv: null, confidence: 'none', reason: 'Texto vazio' };
  }

  // 1. Limpa wake word + cortesias
  const withoutWake = stripWakeWord(rawText);
  const cleaned = stripPoliteness(withoutWake);

  const text = cleaned || withoutWake || rawText;
  const normalized = normalize(text);
  const jiraKey = extractJiraKey(text);

  // 2. Intents com argumento (quando há chave Jira)
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
        confidence: kwHit.score >= 1 ? 'high' : 'medium',
        matchedBy: 'keyword+arg',
        matched: kwHit.matchedKws,
        arg: jiraKey,
        description: kwHit.intent.description,
      };
    }
  }

  // 3. Intents simples — frase mais longa vence
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

  // 4. Intents simples — keywords + context
  const kwHit = findBestKeywordMatch(normalized, SIMPLE_INTENTS);
  if (kwHit && kwHit.score >= KEYWORD_THRESHOLD) {
    return {
      intent: kwHit.intent.id,
      argv: kwHit.intent.argv,
      confidence: kwHit.score >= 1 ? 'high' : 'medium',
      matchedBy: 'keyword',
      matched: kwHit.matchedKws,
      description: kwHit.intent.description,
    };
  }

  // 5. Fallback: se só veio uma chave Jira, assume jira-view
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