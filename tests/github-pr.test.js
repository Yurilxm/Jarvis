import { jest } from '@jest/globals';

describe('getRepoInfo', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('parseia remote HTTPS', async () => {
    jest.unstable_mockModule('node:child_process', () => ({
      execSync: jest.fn(() => 'https://github.com/kayomacedo/Jarvis.git\n'),
      execFileSync: jest.fn(),
    }));
    jest.unstable_mockModule('../src/github/client.js', () => ({
      octokit: { rest: {} },
    }));

    const { getRepoInfo } = await import('../src/github/pr.js');
    expect(getRepoInfo()).toEqual({ owner: 'kayomacedo', repo: 'Jarvis' });
  });

  it('parseia remote SSH', async () => {
    jest.unstable_mockModule('node:child_process', () => ({
      execSync: jest.fn(() => 'git@github.com:Yurilxm/Jarvis.git\n'),
      execFileSync: jest.fn(),
    }));
    jest.unstable_mockModule('../src/github/client.js', () => ({
      octokit: { rest: {} },
    }));

    const { getRepoInfo } = await import('../src/github/pr.js');
    expect(getRepoInfo()).toEqual({ owner: 'Yurilxm', repo: 'Jarvis' });
  });

  it('retorna nulls quando não há remote', async () => {
    jest.unstable_mockModule('node:child_process', () => ({
      execSync: jest.fn(() => {
        throw new Error('no remote');
      }),
      execFileSync: jest.fn(),
    }));
    jest.unstable_mockModule('../src/github/client.js', () => ({
      octokit: { rest: {} },
    }));

    const { getRepoInfo } = await import('../src/github/pr.js');
    expect(getRepoInfo()).toEqual({ owner: null, repo: null });
  });
});
