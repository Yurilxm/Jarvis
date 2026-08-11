import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('jarvis add — validate + register', () => {
  let tempHome;
  let projectDir;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-add-home-'));
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-add-proj-'));
    jest.spyOn(os, 'homedir').mockReturnValue(tempHome);
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      fs.rmSync(tempHome, { recursive: true, force: true });
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('rejeita pasta sem git', async () => {
    const { validateProjectDir } = await import('../src/commands/add-project.js');
    const result = validateProjectDir(projectDir);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Git/i);
  });

  it('aceita raiz git e salva caminho na lista', async () => {
    fs.mkdirSync(path.join(projectDir, '.git'), { recursive: true });

    const { addCurrentProject, validateProjectDir } = await import('../src/commands/add-project.js');
    const { getManagedProjects, getLastProjectPath } = await import('../src/config/preferences.js');

    expect(validateProjectDir(projectDir).ok).toBe(true);

    const first = addCurrentProject(projectDir);
    expect(first.added).toBe(true);
    expect(first.root).toBe(path.resolve(projectDir));
    expect(getManagedProjects()).toHaveLength(1);
    expect(getManagedProjects()[0].path).toBe(path.resolve(projectDir));
    expect(getLastProjectPath()).toBe(path.resolve(projectDir));

    const second = addCurrentProject(projectDir);
    expect(second.already).toBe(true);
    expect(getManagedProjects()).toHaveLength(1);
  });
});
