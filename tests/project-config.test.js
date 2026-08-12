import { loadProjectConfig, getProjectConfig } from '../src/config/project.js';
import { makeTempDir, removeTempDir, writeFile } from './helpers/temp.js';
import path from 'node:path';

describe('project config', () => {
  let cwd;
  let originalCwd;

  beforeEach(() => {
    cwd = makeTempDir();
    originalCwd = process.cwd();
    process.chdir(cwd);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    removeTempDir(cwd);
  });

  it('retorna null quando arquivo não existe', () => {
    expect(loadProjectConfig()).toBeNull();
  });

  it('carrega .jarvis-dev.json válido', () => {
    writeFile(
      cwd,
      '.jarvis-dev.json',
      JSON.stringify({
        jira: { projectKey: 'SDG', projectId: '10033' },
        git: { protectedBranch: 'main' },
      })
    );

    const config = loadProjectConfig();
    expect(config.jira.projectKey).toBe('SDG');
    expect(getProjectConfig('jira.projectKey')).toBe('SDG');
    expect(getProjectConfig('jira.missing', 'fallback')).toBe('fallback');
    expect(getProjectConfig('git.protectedBranch')).toBe('main');
  });

  it('retorna null para JSON inválido', () => {
    writeFile(cwd, '.jarvis-dev.json', '{not-json');
    expect(loadProjectConfig()).toBeNull();
  });
});
