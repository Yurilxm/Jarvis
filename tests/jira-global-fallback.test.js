import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('fallback global do Jira', () => {
  let tempHome;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-jira-global-'));
    jest.spyOn(os, 'homedir').mockReturnValue(tempHome);
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      fs.rmSync(tempHome, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('usa valores globais quando não existe .jarvis-dev.json', async () => {
    const { setGlobalJiraConfig } = await import('../src/config/preferences.js');
    const { getProjectConfig } = await import('../src/config/project.js');

    setGlobalJiraConfig({ projectKey: 'SDG', projectId: '10033', issueType: 'Tarefa' });

    expect(getProjectConfig('jira.projectKey')).toBe('SDG');
    expect(getProjectConfig('jira.projectId')).toBe('10033');
    expect(getProjectConfig('jira.issueType')).toBe('Tarefa');
  });

  it('prioriza .jarvis-dev.json em vez do global', async () => {
    const { setGlobalJiraConfig } = await import('../src/config/preferences.js');
    setGlobalJiraConfig({ projectKey: 'GLOBAL_KEY', projectId: '99999', issueType: 'Tarefa' });

    // Cria um .jarvis-dev.json no cwd temporário
    const cwd = process.cwd();
    fs.writeFileSync(
      path.join(cwd, '.jarvis-dev.json'),
      JSON.stringify({
        jira: { projectKey: 'PROJETO_KEY', projectId: '10033' },
      }),
      'utf-8'
    );

    const { getProjectConfig } = await import('../src/config/project.js');

    expect(getProjectConfig('jira.projectKey')).toBe('PROJETO_KEY');
    expect(getProjectConfig('jira.projectId')).toBe('10033');
    expect(getProjectConfig('jira.issueType')).toBe('Tarefa');

    fs.rmSync(path.join(cwd, '.jarvis-dev.json'), { force: true });
  });

  it('retorna default quando não há projeto nem global', async () => {
    const { getProjectConfig } = await import('../src/config/project.js');

    expect(getProjectConfig('jira.projectKey', 'DEFAULT')).toBe('DEFAULT');
    expect(getProjectConfig('jira.projectId')).toBeNull();
  });
});