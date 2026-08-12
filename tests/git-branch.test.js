import { jest } from '@jest/globals';

describe('git branch wrappers', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('getCurrentBranch trimma saída', async () => {
    jest.unstable_mockModule('node:child_process', () => ({
      execSync: jest.fn(() => 'dev\n'),
      execFileSync: jest.fn(),
    }));

    const { getCurrentBranch } = await import('../src/git/branch.js');
    expect(getCurrentBranch()).toBe('dev');
  });

  it('switchBranch retorna success false em erro', async () => {
    jest.unstable_mockModule('node:child_process', () => ({
      execSync: jest.fn(() => {
        const err = new Error('fail');
        err.stderr = 'pathspec did not match';
        throw err;
      }),
      execFileSync: jest.fn(),
    }));

    const { switchBranch } = await import('../src/git/branch.js');
    const result = switchBranch('nope');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/pathspec|fail/);
  });

  it('mergeBranch detecta conflito', async () => {
    jest.unstable_mockModule('node:child_process', () => ({
      execSync: jest.fn(() => {
        const err = new Error('merge failed');
        err.stderr = 'CONFLICT (content): Merge conflict in a.js';
        throw err;
      }),
      execFileSync: jest.fn(),
    }));

    const { mergeBranch } = await import('../src/git/branch.js');
    const result = mergeBranch('feature');
    expect(result.success).toBe(false);
    expect(result.conflicted).toBe(true);
  });
});
