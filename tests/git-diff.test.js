import { stageFiles } from '../src/git/diff.js';
import { jest } from '@jest/globals';
import { makeTempDir, removeTempDir, writeFile } from './helpers/temp.js';

describe('git diff helpers', () => {
  it('getSafeDiff concatena tracked + untracked', async () => {
    jest.resetModules();
    jest.unstable_mockModule('node:child_process', () => ({
      execFileSync: jest.fn((cmd, args) => {
        if (args.includes('--staged')) return 'STAGED';
        return 'UNSTAGED';
      }),
      execSync: jest.fn(),
    }));

    const cwd = makeTempDir();
    const original = process.cwd();
    try {
      process.chdir(cwd);
      writeFile(cwd, 'novo.js', 'console.log(1)\n');

      const { getSafeDiff: safeDiff } = await import('../src/git/diff.js');
      const out = safeDiff({ tracked: ['a.js'], untracked: ['novo.js'] });
      expect(out).toContain('STAGED');
      expect(out).toContain('UNSTAGED');
      expect(out).toContain('novo.js');
      expect(out).toContain('+console.log(1)');
    } finally {
      process.chdir(original);
      removeTempDir(cwd);
    }
  });

  it('stageFiles lança se lista vazia', () => {
    expect(() => stageFiles([])).toThrow(/Nenhum arquivo/);
  });
});
