import { describe, it, expect } from '@jest/globals';
import { summarizeForSpeech } from '../src/voice/tts-summaries.js';

describe('tts-summaries \u2014 status', () => {
  it('arvore limpa', () => {
    const lines = [
      'Branch  main (protegida)',
      'Locais  main',
      '\u00c1rvore de trabalho limpa.',
    ];
    const r = summarizeForSpeech('status', ['status'], lines);
    expect(r).toMatch(/main/);
    expect(r).toMatch(/limpa/i);
  });

  it('N arquivos alterados', () => {
    const lines = [
      'Branch  dev',
      'Locais  dev \u00b7 main',
      '4 arquivo(s) com altera\u00e7\u00f5es',
      'modificados',
      '~ a.js',
    ];
    const r = summarizeForSpeech('status', ['status'], lines);
    expect(r).toMatch(/dev/);
    expect(r).toMatch(/4/);
    expect(r).toMatch(/alterado/i);
  });

  it('sem branch \u2192 null', () => {
    expect(summarizeForSpeech('status', ['status'], ['qualquer coisa'])).toBeNull();
  });
});

describe('tts-summaries \u2014 jira list', () => {
  it('conta issues ativas', () => {
    const lines = [
      '',
      '  SDG-152  teste do 14B',
      '     Tarefa \u00b7 Em andamento',
      '',
      '  SDG-146  outra coisa',
      '     Tarefa \u00b7 Em andamento',
      '',
      '  SDG-147  mais uma',
      '     Tarefa \u00b7 Futuras',
    ];
    const r = summarizeForSpeech('jira-list', ['jira', 'list'], lines);
    expect(r).toMatch(/3/);
    expect(r).toMatch(/ativa/i);
  });

  it('zero issues', () => {
    const r = summarizeForSpeech('jira-list', ['jira', 'list'], ['Nenhuma issue.']);
    expect(r).toMatch(/Nenhuma/);
  });

  it('uma issue (singular)', () => {
    const lines = ['  SDG-1  x'];
    const r = summarizeForSpeech('jira-list', ['jira', 'list'], lines);
    expect(r).toMatch(/1 tarefa/);
  });

  it('done usa "concluidas"', () => {
    const lines = ['  SDG-1  x', '  SDG-2  y'];
    const r = summarizeForSpeech('jira-list-done', ['jira', 'list', 'done'], lines);
    expect(r).toMatch(/2/);
    expect(r).toMatch(/concluidas/);
  });
});

describe('tts-summaries \u2014 pr list', () => {
  it('conta PRs', () => {
    const lines = [
      '#5  Minha PR',
      '  dev \u2192 main',
      '#6  Outra PR',
    ];
    const r = summarizeForSpeech('pr-list', ['pr', 'list'], lines);
    expect(r).toMatch(/2/);
    expect(r).toMatch(/PR/);
  });

  it('zero PRs', () => {
    expect(summarizeForSpeech('pr-list', ['pr', 'list'], ['x'])).toMatch(/Nenhuma/);
  });
});

describe('tts-summaries \u2014 today', () => {
  it('resume issues + PRs', () => {
    const lines = [
      'Branch  dev',
      '\u00c1rvore limpa',
      '  SDG-1  a',
      '  SDG-2  b',
      '  SDG-3  c',
      '#4  PR one',
      '#5  PR two',
    ];
    const r = summarizeForSpeech('today', ['today'], lines);
    expect(r).toMatch(/3/);
    expect(r).toMatch(/2/);
  });

  it('vazio \u2192 mensagem padrao', () => {
    const r = summarizeForSpeech('today', ['today'], ['sem nada']);
    expect(r).toMatch(/Resumo do dia/);
  });
});

describe('tts-summaries \u2014 jira view', () => {
  it('le titulo, status e responsavel', () => {
    const lines = [
      'SDG-147',
      'T\u00edtulo      0.8 - Realizar sess\u00e3o',
      'Status      Em andamento',
      'Respons\u00e1vel Fellipe Vaz',
    ];
    const r = summarizeForSpeech('jira-view', ['jira', 'view', 'SDG-147'], lines);
    expect(r).toMatch(/SDG-147/);
    expect(r).toMatch(/Realizar sess/);
    expect(r).toMatch(/Em andamento/);
    expect(r).toMatch(/Fellipe/);
  });
});

describe('tts-summaries \u2014 jira move / create', () => {
  it('move extrai key', () => {
    const lines = ['SDG-147 movida com sucesso!'];
    expect(summarizeForSpeech('jira-move', ['jira', 'move'], lines)).toMatch(/SDG-147/);
  });

  it('create extrai key', () => {
    const lines = ['Task SDG-152 criada com sucesso!'];
    expect(summarizeForSpeech('jira-create', ['jira', 'create'], lines)).toMatch(/SDG-152/);
  });
});

describe('tts-summaries \u2014 fallback', () => {
  it('intent desconhecido \u2192 null', () => {
    expect(summarizeForSpeech('blah', [], ['x'])).toBeNull();
  });

  it('sem linhas \u2192 null', () => {
    expect(summarizeForSpeech('status', ['status'], [])).toBeNull();
  });
});
