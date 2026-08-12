import fs from 'node:fs';
import path from 'node:path';
import { discoverProjects, isGitRoot } from '../src/utils/project-scanner.js';
import { makeTempDir, removeTempDir, writeFile } from './helpers/temp.js';

function makeGitRoot(dir) {
  fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
}

describe('project-scanner', () => {
  let root;

  beforeEach(() => {
    root = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(root);
  });

  it('isGitRoot reconhece .git', () => {
    expect(isGitRoot(root)).toBe(false);
    makeGitRoot(root);
    expect(isGitRoot(root)).toBe(true);
  });

  it('descobre projetos em subpastas até depth 4', () => {
    const a = path.join(root, 'projeto-a');
    const b = path.join(root, 'grupo', 'projeto-b');
    const deep = path.join(root, 'l1', 'l2', 'l3', 'projeto-deep');
    const tooDeep = path.join(root, 'l1', 'l2', 'l3', 'l4', 'projeto-longe');

    fs.mkdirSync(a, { recursive: true });
    fs.mkdirSync(b, { recursive: true });
    fs.mkdirSync(deep, { recursive: true });
    fs.mkdirSync(tooDeep, { recursive: true });
    makeGitRoot(a);
    makeGitRoot(b);
    makeGitRoot(deep);
    makeGitRoot(tooDeep);

    const { projects, rootIsGit, maxDepth } = discoverProjects(root, { maxDepth: 4 });

    expect(rootIsGit).toBe(false);
    expect(maxDepth).toBe(4);
    expect(projects.map((p) => p.relativePath)).toEqual(
      expect.arrayContaining(['projeto-a', 'grupo/projeto-b', 'l1/l2/l3/projeto-deep'])
    );
    expect(projects.map((p) => p.relativePath)).not.toContain('l1/l2/l3/l4/projeto-longe');
    expect(projects).toHaveLength(3);
  });

  it('ignora node_modules e continua na raiz vinculada', () => {
    const app = path.join(root, 'app');
    const nested = path.join(root, 'node_modules', 'pkg');
    fs.mkdirSync(app, { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    makeGitRoot(app);
    makeGitRoot(nested);
    writeFile(root, '.jarvis-dev.json', '{}');

    const result = discoverProjects(root, { maxDepth: 4 });
    expect(result.root).toBe(path.resolve(root));
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].name).toBe('app');
  });

  it('não inclui a raiz na lista de projetos aninhados', () => {
    makeGitRoot(root);
    const child = path.join(root, 'svc');
    fs.mkdirSync(child, { recursive: true });
    makeGitRoot(child);

    const result = discoverProjects(root, { maxDepth: 2 });
    expect(result.rootIsGit).toBe(true);
    expect(result.projects.map((p) => p.relativePath)).toEqual(['svc']);
  });
});
