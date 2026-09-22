import { syncHistoryFromGit, getGitCommits, getCommitFiles } from '../src/history/sync.js';
import { appendHistory, readHistory } from '../src/history/store.js';
import { makeTempDir, removeTempDir } from './helpers/temp.js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function initGitRepo(dir) {
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

function makeCommit(dir, filename, content, message) {
  fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
  execFileSync('git', ['add', filename], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', message], { cwd: dir });
}

describe('history sync — getGitCommits', () => {
  let cwd;

  beforeEach(() => {
    cwd = makeTempDir();
    initGitRepo(cwd);
  });

  afterEach(() => {
    removeTempDir(cwd);
  });

  it('retorna [] sem commits', () => {
    expect(getGitCommits(10, cwd)).toEqual([]);
  });

  it('retorna commits com hash, título e body', () => {
    makeCommit(cwd, 'a.txt', 'hello', 'feat: primeira feature');
    const commits = getGitCommits(10, cwd);
    expect(commits).toHaveLength(1);
    expect(commits[0].hash).toMatch(/^[0-9a-f]{40}$/);
    expect(commits[0].title).toBe('feat: primeira feature');
    expect(commits[0].shortHash).toBeTruthy();
  });

  it('ordena do mais recente para o mais antigo', () => {
    makeCommit(cwd, 'a.txt', '1', 'primeiro');
    makeCommit(cwd, 'b.txt', '2', 'segundo');
    const commits = getGitCommits(10, cwd);
    expect(commits[0].title).toBe('segundo');
    expect(commits[1].title).toBe('primeiro');
  });

  it('respeita o limit', () => {
    makeCommit(cwd, 'a.txt', '1', 'um');
    makeCommit(cwd, 'b.txt', '2', 'dois');
    makeCommit(cwd, 'c.txt', '3', 'tres');
    expect(getGitCommits(2, cwd)).toHaveLength(2);
  });
});

describe('history sync — getCommitFiles', () => {
  let cwd;

  beforeEach(() => {
    cwd = makeTempDir();
    initGitRepo(cwd);
  });

  afterEach(() => {
    removeTempDir(cwd);
  });

  it('lista arquivos do commit', () => {
    makeCommit(cwd, 'foo.txt', 'x', 'add foo');
    const [commit] = getGitCommits(1, cwd);
    expect(getCommitFiles(commit.hash, cwd)).toEqual(['foo.txt']);
  });

  it('retorna [] para hash inválido', () => {
    expect(getCommitFiles('deadbeef', cwd)).toEqual([]);
    expect(getCommitFiles('', cwd)).toEqual([]);
  });
});

describe('history sync — syncHistoryFromGit', () => {
  let cwd;

  beforeEach(() => {
    cwd = makeTempDir();
    initGitRepo(cwd);
  });

  afterEach(() => {
    removeTempDir(cwd);
  });

  it('adiciona commits manuais ao histórico', () => {
    makeCommit(cwd, 'a.txt', '1', 'feat: primeira');
    makeCommit(cwd, 'b.txt', '2', 'fix: segunda');

    const result = syncHistoryFromGit({ cwd });
    expect(result.added).toBe(2);
    expect(result.scanned).toBe(2);

    const history = readHistory({ cwd });
    expect(history).toHaveLength(2);
    expect(history[0].source).toBe('git');
    expect(history[0].title).toBe('fix: segunda');
    expect(history[1].title).toBe('feat: primeira');
  });

  it('não duplica commits já no histórico', () => {
    makeCommit(cwd, 'a.txt', '1', 'feat: única');

    syncHistoryFromGit({ cwd });
    const second = syncHistoryFromGit({ cwd });

    expect(second.added).toBe(0);
    expect(readHistory({ cwd })).toHaveLength(1);
  });

  it('não duplica se commit foi registrado pelo Jarvis', () => {
    makeCommit(cwd, 'a.txt', '1', 'feat: única');
    const [commit] = getGitCommits(1, cwd);

    appendHistory(
      {
        action: 'commit',
        source: 'jarvis',
        hash: commit.hash,
        title: 'feat: única',
      },
      cwd
    );

    const result = syncHistoryFromGit({ cwd });
    expect(result.added).toBe(0);
    expect(readHistory({ cwd })).toHaveLength(1);
  });

  it('dryRun não grava nada', () => {
    makeCommit(cwd, 'a.txt', '1', 'feat: teste');

    const result = syncHistoryFromGit({ cwd, dryRun: true });
    expect(result.added).toBe(1);
    expect(readHistory({ cwd })).toHaveLength(0);
  });

  it('retorna repo=null quando não é repo git', () => {
    const noGit = makeTempDir();
    try {
      const result = syncHistoryFromGit({ cwd: noGit });
      expect(result.repo).toBeNull();
      expect(result.added).toBe(0);
    } finally {
      removeTempDir(noGit);
    }
  });

  it('marca jiraIssue quando branch tem chave', () => {
    execFileSync('git', ['checkout', '-q', '-b', 'feature/SDG-42-teste'], { cwd });
    makeCommit(cwd, 'a.txt', '1', 'feat: teste');

    syncHistoryFromGit({ cwd });
    const [entry] = readHistory({ cwd });
    expect(entry.jiraIssue).toBe('SDG-42');
  });
});