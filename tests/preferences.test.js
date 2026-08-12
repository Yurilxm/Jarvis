import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('preferences — menuStyle', () => {
  let tempHome;
  let originalHomedir;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-prefs-'));
    originalHomedir = os.homedir;
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

  it('default é live', async () => {
    const { getMenuStyle } = await import('../src/config/preferences.js');
    expect(getMenuStyle()).toBe('live');
  });

  it('persiste classic e volta a live', async () => {
    const { getMenuStyle, setMenuStyle, getPreferencesPath } = await import(
      '../src/config/preferences.js'
    );

    setMenuStyle('classic');
    expect(getMenuStyle()).toBe('classic');
    expect(fs.existsSync(getPreferencesPath())).toBe(true);
    expect(getPreferencesPath()).toContain(tempHome);

    setMenuStyle('live');
    expect(getMenuStyle()).toBe('live');
  });

  it('launchMode default menu e persiste commands', async () => {
    const { getLaunchMode, setLaunchMode } = await import('../src/config/preferences.js');
    expect(getLaunchMode()).toBe('menu');
    setLaunchMode('commands');
    expect(getLaunchMode()).toBe('commands');
    setLaunchMode('menu');
    expect(getLaunchMode()).toBe('menu');
  });

  it('ignora valor inválido e cai em live', async () => {
    const { savePreferences, getMenuStyle } = await import('../src/config/preferences.js');
    savePreferences({ menuStyle: 'weird' });
    expect(getMenuStyle()).toBe('live');
  });
});
