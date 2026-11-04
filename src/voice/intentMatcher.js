import { SIMPLE_INTENTS, ARG_INTENTS, PR_INTENTS } from './intents.js';

// Reexporta os catálogos para quem importava daqui antes.
export { SIMPLE_INTENTS, ARG_INTENTS, PR_INTENTS };

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

  out = out.replace(/^(por favor|por gentileza|por obséquio|por favor,|por gentileza,)[\s,]+/i, '');
  out = out.replace(/[\s,]+(por favor|por gentileza|por obséquio|obrigado|obrigada|valeu|vlw)[.!?]?$/i, '');

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
 * Palavras de ligacao em PT-BR que nao carregam intencao. Ignoradas
 * no fuzzy matching pra dar robustez a transcricoes que cortam ou
 * trocam artigos.
 */
export const STOPWORDS_PT = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das',
  'me', 'te', 'se', 'lhe', 'nos', 'vos',
  'que', 'qual', 'quais',
  'pra', 'para', 'por', 'com', 'sem', 'em', 'no', 'na',
  'e', 'ou', 'mas',
  'ai', 'entao', 'tipo', 'so', 'apenas', 'ate',
  'favor', 'gentileza',
  'meu', 'minha', 'meus', 'minhas', 'teu', 'tua',
  'este', 'esta', 'esse', 'essa', 'isso', 'aquilo',
  'ja', 'ainda', 'agora', 'depois', 'antes',
  'bem', 'muito', 'pouco', 'mais', 'menos',
  'todo', 'toda', 'todos', 'todas',
]);

/**
 * Tokeniza pra fuzzy: split simples, mantem tokens >= 2 chars e nao
 * stopwords.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  const norm = normalize(text);
  if (!norm) return [];
  return norm
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS_PT.has(t));
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

/**
 * Extrai um número de PR (ex: "ver pr 5" → "5").
 * Aceita variações: "pr 5", "pr #5", "pr5", "pull request 5", "#5".
 * @param {string} text
 * @returns {string|null}
 */
export function extractPrNumber(text) {
  if (!text) return null;
  const s = String(text);

  // Formas com "pr" ou "pull request" antes do número
  const withPrefix = s.match(/(?:pr|pull\s*request|pull)\s*#?\s*(\d+)/i);
  if (withPrefix) return withPrefix[1];

  // Só "#N"
  const hashOnly = s.match(/#\s*(\d+)/);
  return hashOnly ? hashOnly[1] : null;
}

const KEYWORD_THRESHOLD = 0.24;
const CONTEXT_BONUS = 0.5;

/**
 * Acha a frase mais longa que casa no texto.
 */
function findLongestPhraseMatch(normalized, intents) {
  const textTokens = new Set(tokenize(normalized));
  const FUZZY_THRESHOLD = 0.7;

  let best = null;

  for (const intent of intents) {
    for (const phrase of intent.phrases) {
      const normPhrase = normalize(phrase);
      if (!normPhrase) continue;

      // 1) Match exato (substring) — sempre vence
      if (normalized.includes(normPhrase)) {
        const candidate = {
          intent,
          phrase,
          normPhrase,
          exact: true,
          fuzzy: false,
          fuzzyRatio: 1,
        };
        if (
          !best ||
          (!best.exact && candidate.exact) ||
          (candidate.exact === best.exact &&
            normPhrase.length > best.normPhrase.length)
        ) {
          best = candidate;
        }
        continue;
      }

      // 2) Fuzzy por tokens (>=70% dos tokens nao-stopword da phrase
      //    precisam estar no texto)
      const phraseTokens = tokenize(phrase);
      if (phraseTokens.length < 2) continue;
      const hits = phraseTokens.filter((t) => textTokens.has(t)).length;
      const ratio = hits / phraseTokens.length;
      if (ratio >= FUZZY_THRESHOLD) {
        // Fuzzy so vence se nao tiver um exato ainda OU se a phrase for
        // substancialmente mais especifica (mais tokens significativos).
        if (
          !best ||
          (!best.exact &&
            (ratio > best.fuzzyRatio ||
              (ratio === best.fuzzyRatio &&
                phraseTokens.length > (best.fuzzyTokens || 0))))
        ) {
          best = {
            intent,
            phrase,
            normPhrase,
            exact: false,
            fuzzy: true,
            fuzzyRatio: ratio,
            fuzzyTokens: phraseTokens.length,
          };
        }
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
  return items.filter((item) => {
    const norm = normalize(item);
    if (!norm) return false;
    // Ignora itens que sao so stopwords ("de", "do", "a"...) — evita
    // casar qualquer texto por conter preposicoes comuns.
    if (STOPWORDS_PT.has(norm)) return false;
    return normalized.includes(norm);
  }).length;
}

/**
 * Tenta casar keywords + context em todos os intents.
 */
function findBestKeywordMatch(normalized, intents) {
  let best = null;
  for (const intent of intents) {
    const kwTotal = intent.keywords?.length || 0;
    if (kwTotal === 0) continue;

    const kwHits = countMatches(normalized, intent.keywords);
    if (kwHits === 0) continue;

    const kwScore = kwHits / kwTotal;
    let score = kwScore;

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
      best = {
        intent,
        score,
        kwHits,
        matchedKws: intent.keywords.filter((kw) => normalized.includes(normalize(kw))),
      };
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
  const prNumber = extractPrNumber(text);

  // 2. Intents com argumento: PR (prioridade porque é mais específico)
  if (prNumber) {
    const phraseHit = findLongestPhraseMatch(normalized, PR_INTENTS);
    if (phraseHit) {
      return {
        intent: phraseHit.intent.id,
        argv: ['pr', phraseHit.intent.sub, prNumber],
        confidence: 'high',
        matchedBy: 'phrase+pr',
        matched: phraseHit.phrase,
        arg: prNumber,
        description: phraseHit.intent.description,
      };
    }

    const kwHit = findBestKeywordMatch(normalized, PR_INTENTS);
    if (kwHit) {
      return {
        intent: kwHit.intent.id,
        argv: ['pr', kwHit.intent.sub, prNumber],
        confidence: kwHit.score >= 1 ? 'high' : 'medium',
        matchedBy: 'keyword+pr',
        matched: kwHit.matchedKws,
        arg: prNumber,
        description: kwHit.intent.description,
      };
    }
  }

  // 3. Intents com argumento: Jira
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

  // 4. Intents simples — frase mais longa vence
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

  // 5. Intents simples — keywords + context
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

  // 6. Fallback: se só veio uma chave Jira, assume jira-view
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

  // 7. Fallback: se só veio número de PR, assume pr-view
  if (prNumber) {
    return {
      intent: 'pr-view',
      argv: ['pr', 'view', prNumber],
      confidence: 'low',
      matchedBy: 'arg-only',
      arg: prNumber,
      description: 'Detalhes de uma Pull Request',
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
      argLabel: '<chave>',
    })),
    ...PR_INTENTS.map((i) => ({
      id: i.id,
      description: i.description,
      argv: ['pr', i.sub],
      needsArg: true,
      argLabel: '<n>',
    })),
  ];
}