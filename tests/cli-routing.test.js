import { ALIASES, resolveCommand } from '../src/cli-routing.js';

describe('cli routing', () => {
  it('resolve aliases conhecidos', () => {
    expect(resolveCommand('c')).toBe('commit');
    expect(resolveCommand('j')).toBe('jira');
    expect(resolveCommand('a')).toBe('analyze');
    expect(resolveCommand('h')).toBe('history');
  });

  it('mantém comando completo', () => {
    expect(resolveCommand('commit')).toBe('commit');
    expect(resolveCommand('pr')).toBe('pr');
  });

  it('propaga undefined/vazio', () => {
    expect(resolveCommand(undefined)).toBeUndefined();
    expect(resolveCommand('')).toBe('');
  });

  it('cobre todos os aliases documentados', () => {
    expect(Object.keys(ALIASES).sort()).toEqual(
      ['a', 'b', 'c', 'd', 'h', 'i', 'j', 'm', 'p', 'r', 's', 't', 'u', 'w'].sort()
    );
  });

  it('resolve alias de projects', () => {
    expect(resolveCommand('w')).toBe('projects');
  });
});
