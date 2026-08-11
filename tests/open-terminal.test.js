import { jest } from '@jest/globals';
import { hasWindowsTerminal, openProjectInTerminal } from '../src/utils/open-terminal.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('open-terminal', () => {
  it('hasWindowsTerminal reflete where wt', () => {
    expect(typeof hasWindowsTerminal()).toBe('boolean');
  });

  it('falha com pasta inexistente', () => {
    const result = openProjectInTerminal(path.join(os.tmpdir(), 'nao-existe-xyz'), 'new-tab');
    expect(result.ok).toBe(false);
  });

  it('aceita pasta existente (spawn detached)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-open-'));
    try {
      const result = openProjectInTerminal(dir, 'new-tab');
      // Em CI sem wt pode cair no fallback PowerShell — ambos ok:true
      expect(result.ok).toBe(true);
      expect(result.method).toMatch(/windows-terminal|powershell/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
