import { detectJiraIssueKey } from '../src/commit/helpers.js';
import { buildReportPrompt } from '../src/report/promptBuilder.js';
import { appendHistory, readHistory } from '../src/history/store.js';
import { makeTempDir, removeTempDir } from './helpers/temp.js';

describe('report — detectJiraIssueKey', () => {
  it('detecta chave em feature/SDG-71-descricao', () => {
    expect(detectJiraIssueKey('feature/SDG-71-descricao')).toBe('SDG-71');
  });

  it('detecta chave no início da branch', () => {
    expect(detectJiraIssueKey('SDG-123-nova-feature')).toBe('SDG-123');
  });

  it('detecta chave em bugfix/JARVIS-9', () => {
    expect(detectJiraIssueKey('bugfix/JARVIS-9')).toBe('JARVIS-9');
  });

  it('retorna null quando não há chave', () => {
    expect(detectJiraIssueKey('dev')).toBeNull();
    expect(detectJiraIssueKey('main')).toBeNull();
    expect(detectJiraIssueKey('feature/sem-chave')).toBeNull();
  });

  it('retorna null para entrada vazia/nula', () => {
    expect(detectJiraIssueKey(null)).toBeNull();
    expect(detectJiraIssueKey(undefined)).toBeNull();
    expect(detectJiraIssueKey('')).toBeNull();
  });
});

describe('report — history com jiraIssue', () => {
  let cwd;

  beforeEach(() => {
    cwd = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(cwd);
  });

  it('appendHistory persiste jiraIssue quando informado', () => {
    const e = appendHistory({ title: 'feat: x', jiraIssue: 'SDG-71' }, cwd);
    expect(e.jiraIssue).toBe('SDG-71');

    const all = readHistory({ cwd });
    expect(all[0].jiraIssue).toBe('SDG-71');
  });

  it('jiraIssue é null quando não informado', () => {
    const e = appendHistory({ title: 'feat: x' }, cwd);
    expect(e.jiraIssue).toBeNull();
  });

  it('readHistory filtra por jiraIssue', () => {
    appendHistory({ title: 'a', jiraIssue: 'SDG-1' }, cwd);
    appendHistory({ title: 'b', jiraIssue: 'SDG-2' }, cwd);
    appendHistory({ title: 'c', jiraIssue: 'SDG-1' }, cwd);

    const only1 = readHistory({ cwd, jiraIssue: 'SDG-1' });
    expect(only1).toHaveLength(2);
    expect(only1.every((e) => e.jiraIssue === 'SDG-1')).toBe(true);
  });

  it('readHistory sem filtro retorna todos', () => {
    appendHistory({ title: 'a', jiraIssue: 'SDG-1' }, cwd);
    appendHistory({ title: 'b' }, cwd);
    expect(readHistory({ cwd })).toHaveLength(2);
  });
});

describe('report — buildReportPrompt', () => {
  const issue = {
    key: 'SDG-71',
    fields: {
      summary: 'Adicionar carrinho lateral',
      status: { name: 'In Progress' },
      issuetype: { name: 'Tarefa' },
      assignee: { displayName: 'Yuri Lima' },
      reporter: { displayName: 'Yuri Lima' },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Implementar carrinho lateral interativo' }],
          },
        ],
      },
    },
  };

  it('inclui chave, título e descrição da issue', () => {
    const prompt = buildReportPrompt(issue, []);
    expect(prompt).toContain('SDG-71');
    expect(prompt).toContain('Adicionar carrinho lateral');
    expect(prompt).toContain('Implementar carrinho lateral interativo');
  });

  it('inclui os commits com hash e título', () => {
    const commits = [
      {
        hash: 'abcdef1234567890',
        title: 'feat: adiciona carrinho',
        body: '- componente lateral',
        files: ['src/cart.js'],
        fileCount: 1,
        diff: '+novo componente',
      },
    ];
    const prompt = buildReportPrompt(issue, commits);
    expect(prompt).toContain('abcdef1');
    expect(prompt).toContain('feat: adiciona carrinho');
    expect(prompt).toContain('src/cart.js');
    expect(prompt).toContain('+novo componente');
  });

  it('lista "(sem descrição)" quando a issue não tem descrição', () => {
    const noDesc = { ...issue, fields: { ...issue.fields, description: null } };
    const prompt = buildReportPrompt(noDesc, []);
    expect(prompt).toContain('(sem descrição)');
  });
});