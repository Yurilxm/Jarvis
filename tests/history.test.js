import {
  appendHistory,
  readHistory,
  findHistoryEntry,
  getHistoryPath,
} from '../src/history/store.js';
import { makeTempDir, removeTempDir } from './helpers/temp.js';
import fs from 'node:fs';

describe('history store', () => {
  let cwd;

  beforeEach(() => {
    cwd = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(cwd);
  });

  it('appendHistory cria arquivo e retorna entry completa', () => {
    const entry = appendHistory(
      {
        branch: 'dev',
        hash: 'abc1234deadbeef',
        title: 'feat: teste',
        body: '- item',
        files: ['a.js', 'b.js'],
        pushed: true,
        pushedAt: '2026-01-01T00:00:00.000Z',
      },
      cwd
    );

    expect(entry.id).toBeTruthy();
    expect(entry.fileCount).toBe(2);
    expect(entry.pushed).toBe(true);
    expect(fs.existsSync(getHistoryPath(cwd))).toBe(true);
  });

  it('readHistory retorna mais recente primeiro e respeita limit', () => {
    appendHistory({ title: 'primeiro', hash: '111' }, cwd);
    appendHistory({ title: 'segundo', hash: '222' }, cwd);
    appendHistory({ title: 'terceiro', hash: '333' }, cwd);

    const all = readHistory({ cwd, limit: 10 });
    expect(all[0].title).toBe('terceiro');
    expect(all).toHaveLength(3);

    const limited = readHistory({ cwd, limit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited[0].title).toBe('terceiro');
  });

  it('readHistory filtra apenas pushed', () => {
    appendHistory({ title: 'local', pushed: false }, cwd);
    appendHistory({ title: 'remoto', pushed: true }, cwd);

    const pushed = readHistory({ cwd, pushedOnly: true });
    expect(pushed).toHaveLength(1);
    expect(pushed[0].title).toBe('remoto');
  });

  it('findHistoryEntry busca por hash curto e título', () => {
    appendHistory({ title: 'feat: historico legal', hash: 'abcdef0123456789' }, cwd);

    expect(findHistoryEntry('abcdef0', cwd)?.title).toBe('feat: historico legal');
    expect(findHistoryEntry('historico', cwd)?.hash).toBe('abcdef0123456789');
    expect(findHistoryEntry('nao-existe', cwd)).toBeNull();
  });

  it('ignora linhas JSON corrompidas', () => {
    const path = getHistoryPath(cwd);
    fs.mkdirSync(path.replace(/history\.jsonl$/, ''), { recursive: true });
    fs.writeFileSync(path, '{bad\n' + JSON.stringify({ title: 'ok', hash: '1', pushed: false }) + '\n', 'utf-8');
    // use append to ensure dir - actually write manually broke structure
    const list = readHistory({ cwd });
    expect(list.some((e) => e.title === 'ok')).toBe(true);
  });
});
