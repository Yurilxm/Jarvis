import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('switch-project helpers', () => {
  let tempHome;
  let workspace;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-switch-'));
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-ws-'));
    jest.spyOn(os, 'homedir').mockReturnValue(tempHome);
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      fs.rmSync(tempHome, { recursive: true, force: true });
      fs.rmSync(workspace, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('lista gerenciados + descobertos e enterProject troca cwd', async () => {
    const a = path.join(workspace, 'app-a');
    const b = path.join(workspace, 'app-b');
    fs.mkdirSync(path.join(a, '.git'), { recursive: true });
    fs.mkdirSync(path.join(b, '.git'), { recursive: true });

    const prefs = await import('../src/config/preferences.js');
    prefs.setWorkspaceRoot(workspace);
    prefs.addManagedProject(a, 'app-a');
    prefs.setProjectOpenMode('none');

    const { listSelectableProjects, enterProject, isAlreadyInProject } = await import(
      '../src/commands/switch-project.js'
    );

    expect(isAlreadyInProject(a)).toBe(true);
    expect(isAlreadyInProject(workspace)).toBe(false);

    const list = listSelectableProjects(workspace);
    expect(list.map((p) => p.name).sort()).toEqual(['app-a', 'app-b']);
    expect(list.find((p) => p.name === 'app-a').source).toBe('managed');
    expect(list.find((p) => p.name === 'app-b').source).toBe('discovered');

    const original = process.cwd();
    try {
      const result = enterProject(b);
      expect(result.absolute).toBe(path.resolve(b));
      expect(result.openMode).toBe('none');
      expect(process.cwd()).toBe(path.resolve(b));
      expect(prefs.getManagedProjects().some((p) => p.path === path.resolve(b))).toBe(true);
      expect(prefs.getLastProjectPath()).toBe(path.resolve(b));
    } finally {
      process.chdir(original);
    }
  });
});
