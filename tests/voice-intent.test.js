import { normalize, extractJiraKey, matchIntent, listIntents } from '../src/voice/intentMatcher.js';

describe('voice — normalize', () => {
  it('minúsculas, sem acentos e sem pontuação', () => {
    expect(normalize('Lista do Jira!')).toBe('lista do jira');
    expect(normalize('Relatório da Task')).toBe('relatorio da task');
    expect(normalize('  Olá,  mundo!  ')).toBe('ola mundo');
  });

  it('lida com vazio/nulo', () => {
    expect(normalize('')).toBe('');
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });

  it('preserva hífen (para chaves Jira)', () => {
    expect(normalize('SDG-71')).toBe('sdg-71');
  });
});

describe('voice — extractJiraKey', () => {
  it('extrai chave no formato PREFIXO-NÚMERO', () => {
    expect(extractJiraKey('relatório da task SDG-71')).toBe('SDG-71');
    expect(extractJiraKey('ver JARVIS-9')).toBe('JARVIS-9');
  });

  it('normaliza para maiúsculas', () => {
    expect(extractJiraKey('ver sdg-71')).toBe('SDG-71');
  });

  it('retorna null quando não há chave', () => {
    expect(extractJiraKey('lista do jira')).toBeNull();
    expect(extractJiraKey('')).toBeNull();
    expect(extractJiraKey(null)).toBeNull();
  });
});

describe('voice — matchIntent (frases simples)', () => {
  it('reconhece "o que eu tenho hoje" como today', () => {
    const r = matchIntent('o que eu tenho hoje');
    expect(r.intent).toBe('today');
    expect(r.argv).toEqual(['today']);
    expect(r.confidence).toBe('high');
  });

  it('reconhece "lista do jira" como jira-list', () => {
    const r = matchIntent('lista do jira');
    expect(r.intent).toBe('jira-list');
    expect(r.argv).toEqual(['jira', 'list']);
  });

  it('reconhece "issues concluídas" como jira-list-done', () => {
    const r = matchIntent('issues concluídas');
    expect(r.intent).toBe('jira-list-done');
    expect(r.argv).toEqual(['jira', 'list', 'done']);
  });

  it('reconhece "status do projeto" como status', () => {
    const r = matchIntent('status do projeto');
    expect(r.intent).toBe('status');
  });

  it('reconhece "fazer commit" como commit', () => {
    const r = matchIntent('fazer commit');
    expect(r.intent).toBe('commit');
  });

  it('reconhece "minhas prs" como pr-list', () => {
    const r = matchIntent('minhas PRs');
    expect(r.intent).toBe('pr-list');
  });

  it('reconhece "ajuda" como help', () => {
    const r = matchIntent('ajuda');
    expect(r.intent).toBe('help');
  });

  it('ignora acentos e caixa', () => {
    expect(matchIntent('LISTA DO JIRÁ').intent).toBe('jira-list');
    expect(matchIntent('Relatório do Dia').intent).toBeNull(); // não é uma frase válida
    expect(matchIntent('Resumo do Dia').intent).toBe('today');
  });
});

describe('voice — matchIntent (com chave Jira)', () => {
  it('reconhece "relatório da task SDG-71" como report', () => {
    const r = matchIntent('relatório da task SDG-71');
    expect(r.intent).toBe('report');
    expect(r.argv).toEqual(['report', 'SDG-71']);
    expect(r.arg).toBe('SDG-71');
  });

  it('reconhece "ver task SDG-71" como jira-view', () => {
    const r = matchIntent('ver task SDG-71');
    expect(r.intent).toBe('jira-view');
    expect(r.argv).toEqual(['jira', 'view', 'SDG-71']);
  });

  it('reconhece "mover task SDG-71" como jira-move', () => {
    const r = matchIntent('mover task SDG-71');
    expect(r.intent).toBe('jira-move');
    expect(r.argv).toEqual(['jira', 'move', 'SDG-71']);
  });

  it('chave sozinha cai em jira-view (fallback)', () => {
    const r = matchIntent('SDG-71');
    expect(r.intent).toBe('jira-view');
    expect(r.confidence).toBe('low');
    expect(r.matchedBy).toBe('arg-only');
  });

  it('chave + palavra solta de relatório casa por keyword', () => {
    const r = matchIntent('relatório SDG-71');
    expect(r.intent).toBe('report');
    expect(r.argv).toEqual(['report', 'SDG-71']);
  });
});

describe('voice — matchIntent (sem match)', () => {
  it('retorna none para texto desconhecido', () => {
    const r = matchIntent('xyz abc def');
    expect(r.intent).toBeNull();
    expect(r.confidence).toBe('none');
  });

  it('retorna none para texto vazio', () => {
    const r = matchIntent('');
    expect(r.intent).toBeNull();
  });

  it('retorna none para null', () => {
    const r = matchIntent(null);
    expect(r.intent).toBeNull();
  });
});

describe('voice — matchIntent (keyword fallback)', () => {
  it('"listar jira" casa jira-list por keywords', () => {
    const r = matchIntent('listar jira');
    expect(r.intent).toBe('jira-list');
  });

  it('"ver issues" casa jira-list', () => {
    const r = matchIntent('ver issues');
    expect(r.intent).toBe('jira-list');
  });
});

describe('voice — listIntents', () => {
  it('retorna todos os intents com metadados', () => {
    const list = listIntents();
    expect(list.length).toBeGreaterThan(10);
    expect(list.find((i) => i.id === 'today')).toBeTruthy();
    expect(list.find((i) => i.id === 'report')?.needsArg).toBe(true);
    expect(list.find((i) => i.id === 'today')?.needsArg).toBe(false);
  });
});