import { jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Mock do child_process ANTES de importar o módulo testado
jest.unstable_mockModule('node:child_process', () => ({
  spawn: jest.fn(() => ({
    unref: jest.fn(),
    on: jest.fn(),
  })),
  execFileSync: jest.fn(() => {
    throw new Error('not found');
  }),
}));

// Import dinâmico após o mock
const { openProjectInTerminal } = await import('../src/utils/open-terminal.js');

describe('open-terminal', () => {
  it('falha com pasta inexistente', () => {
    const result = openProjectInTerminal(path.join(os.tmpdir(), 'nao-existe-xyz'), 'new-tab');
    expect(result.ok).toBe(false);
  });

  it('aceita pasta existente sem abrir terminal real', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-open-test-'));
    try {
      const result = openProjectInTerminal(dir, 'new-tab');
      expect(typeof result.ok).toBe('boolean');
      expect(result.method).toMatch(/windows-terminal|powershell|unsupported|none/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});