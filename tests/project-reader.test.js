import { shouldIgnore, getDirectoryTree, getKeyFiles, readFileContent } from '../src/utils/project-reader.js';
import { makeTempDir, removeTempDir, writeFile } from './helpers/temp.js';
import path from 'node:path';
import fs from 'node:fs';

describe('project-reader', () => {
  it('shouldIgnore bloqueia node_modules e assets', () => {
    expect(shouldIgnore('node_modules/x')).toBe(true);
    expect(shouldIgnore('foo.png')).toBe(true);
    expect(shouldIgnore('src/app.js')).toBe(false);
  });

  it('getDirectoryTree e getKeyFiles respeitam ignore', () => {
    const cwd = makeTempDir();
    const original = process.cwd();
    try {
      process.chdir(cwd);
      writeFile(cwd, 'src/app.js', 'console.log(1)\n');
      writeFile(cwd, 'node_modules/pkg/index.js', 'module.exports=1\n');
      fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });

      const tree = getDirectoryTree(cwd, 2);
      expect(tree).toContain('app.js');
      expect(tree).not.toContain('node_modules');

      const keys = getKeyFiles(cwd, ['.js']);
      expect(keys.some((f) => f.path.endsWith('app.js'))).toBe(true);
      expect(keys.every((f) => !f.path.includes('node_modules'))).toBe(true);
    } finally {
      process.chdir(original);
      removeTempDir(cwd);
    }
  });

  it('readFileContent trunca arquivos longos', () => {
    const cwd = makeTempDir();
    try {
      const lines = Array.from({ length: 250 }, (_, i) => `line ${i}`).join('\n');
      const file = path.join(cwd, 'big.txt');
      fs.writeFileSync(file, lines, 'utf-8');
      const content = readFileContent(file);
      expect(content).toContain('... (truncado)');
      expect(content.split('\n').length).toBeLessThan(210);
    } finally {
      removeTempDir(cwd);
    }
  });
});
