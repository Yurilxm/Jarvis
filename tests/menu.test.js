import { COMMAND_CATALOG, getFilteredEntries, matchesEntry } from '../src/commands/menu.js';

describe('menu — catálogo', () => {
  it('possui comandos essenciais', () => {
    const ids = COMMAND_CATALOG.map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'commit',
        'status',
        'jira-list',
        'pr-list',
        'ignore',
        'history',
        'analyze',
        'check',
        'scan',
      ])
    );
  });

  it('todo comando tem argv não vazio', () => {
    for (const entry of COMMAND_CATALOG) {
      expect(entry.argv.length).toBeGreaterThan(0);
      expect(entry.label).toMatch(/^jarvis /);
    }
  });
});

describe('menu — filtro inteligente', () => {
  it('filtra jira sem trazer profile por engano', () => {
    const ids = getFilteredEntries('jira').map((e) => e.id);
    expect(ids.every((id) => id.startsWith('jira') || id === 'config')).toBe(true);
    expect(ids).toEqual(expect.arrayContaining(['jira-list', 'jira-view', 'jira-create']));
    expect(ids).not.toContain('profile-show');
    expect(ids).not.toContain('today');
  });

  it('filtra commit', () => {
    const ids = getFilteredEntries('commit').map((e) => e.id);
    expect(ids).toContain('commit');
  });

  it('string vazia retorna todos', () => {
    expect(getFilteredEntries('').length).toBe(COMMAND_CATALOG.length);
    expect(getFilteredEntries(null).length).toBe(COMMAND_CATALOG.length);
  });

  it('matchesEntry respeita keywords', () => {
    const commit = COMMAND_CATALOG.find((c) => c.id === 'commit');
    expect(matchesEntry(commit, 'gemini')).toBe(true);
    expect(matchesEntry(commit, 'xyzxyz')).toBe(false);
  });
});
