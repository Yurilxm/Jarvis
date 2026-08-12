import { parsePorcelainLine, unquotePath, getGitStatus, isGitRepo } from '../src/git/status.js';
import { jest } from '@jest/globals';

describe('unquotePath', () => {
  it('remove aspas e unescapa', () => {
    expect(unquotePath('"arquivo\\040novo.txt"')).toBe('arquivo novo.txt');
    expect(unquotePath('normal.txt')).toBe('normal.txt');
  });
});

describe('parsePorcelainLine', () => {
  it('parseia modificado no worktree', () => {
    expect(parsePorcelainLine(' M src/cli.js')).toEqual({
      status: ' M',
      file: 'src/cli.js',
    });
  });

  it('parseia untracked', () => {
    expect(parsePorcelainLine('?? novo.txt')).toEqual({
      status: '??',
      file: 'novo.txt',
    });
  });

  it('parseia staged add', () => {
    expect(parsePorcelainLine('A  src/a.js')).toEqual({
      status: 'A ',
      file: 'src/a.js',
    });
  });

  it('parseia rename pegando path novo', () => {
    expect(parsePorcelainLine('R  old.js -> new.js')).toEqual({
      status: 'R ',
      file: 'new.js',
    });
  });

  it('parseia path com aspas', () => {
    const result = parsePorcelainLine('?? "meu arquivo.txt"');
    expect(result.status).toBe('??');
    expect(result.file).toBe('meu arquivo.txt');
  });
});

describe('getGitStatus / isGitRepo com mock', () => {
  it('classifica porcelain corretamente', async () => {
    jest.resetModules();
    jest.unstable_mockModule('node:child_process', () => ({
      execSync: jest.fn(() =>
        [' M a.js', 'A  b.js', 'D  c.js', '?? d.js', 'MM e.js'].join('\n')
      ),
      execFileSync: jest.fn(),
    }));

    const { getGitStatus: getStatus } = await import('../src/git/status.js');
    const status = getStatus();

    expect(status.modified).toEqual(expect.arrayContaining(['a.js', 'e.js']));
    expect(status.staged).toEqual(expect.arrayContaining(['b.js', 'e.js']));
    expect(status.deleted).toContain('c.js');
    expect(status.untracked).toContain('d.js');
  });

  it('isGitRepo retorna false quando execSync falha', async () => {
    jest.resetModules();
    jest.unstable_mockModule('node:child_process', () => ({
      execSync: jest.fn(() => {
        throw new Error('not a git repo');
      }),
      execFileSync: jest.fn(),
    }));

    const { isGitRepo: check } = await import('../src/git/status.js');
    expect(check()).toBe(false);
  });
});
