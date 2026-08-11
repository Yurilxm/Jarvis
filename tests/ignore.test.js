import {
  DEFAULT_IGNORE_PATTERNS,
  isIgnored,
  filterIgnoredFiles,
  addIgnorePatterns,
  removeIgnorePatterns,
  restoreDefaultPatterns,
  getIgnoreInventory,
  readJarvisIgnore,
  loadIgnore,
} from '../src/config/ignore.js';
import { makeTempDir, removeTempDir, writeFile } from './helpers/temp.js';

describe('ignore — defaults', () => {
  it('bloqueia .env e variantes', () => {
    const dir = makeTempDir();
    try {
      const ig = loadIgnore(dir);
      expect(ig.ignores('.env')).toBe(true);
      expect(ig.ignores('.env.local')).toBe(true);
      expect(ig.ignores('src/cli.js')).toBe(false);
    } finally {
      removeTempDir(dir);
    }
  });

  it('bloqueia chaves e secrets por padrão', () => {
    expect(isIgnored('id_rsa')).toBe(true);
    expect(isIgnored('foo.pem')).toBe(true);
    expect(isIgnored('secrets/db.json')).toBe(true);
    expect(isIgnored('my-credentials.json')).toBe(true);
  });

  it('não bloqueia código-fonte comum', () => {
    expect(isIgnored('src/commit/flow.js')).toBe(false);
    expect(isIgnored('README.md')).toBe(false);
  });

  it('DEFAULT_IGNORE_PATTERNS contém .jarvis/', () => {
    expect(DEFAULT_IGNORE_PATTERNS).toContain('.jarvis/');
  });
});

describe('ignore — .jarvisignore custom', () => {
  let cwd;

  beforeEach(() => {
    cwd = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(cwd);
  });

  it('addIgnorePatterns persiste e filtra arquivos', () => {
    const added = addIgnorePatterns(['dist/', '*.local'], cwd);
    expect(added).toEqual(['dist/', '*.local']);

    const { custom } = readJarvisIgnore(cwd);
    expect(custom).toEqual(['dist/', '*.local']);

    const { safe, blocked } = filterIgnoredFiles(
      ['src/a.js', 'dist/bundle.js', 'env.local'],
      cwd
    );
    expect(safe).toContain('src/a.js');
    expect(blocked).toEqual(expect.arrayContaining(['dist/bundle.js', 'env.local']));
  });

  it('removeIgnorePatterns remove custom e desativa default', () => {
    addIgnorePatterns(['coverage/'], cwd);
    removeIgnorePatterns(['coverage/', '.env'], cwd);

    const inv = getIgnoreInventory(cwd);
    expect(inv.custom).not.toContain('coverage/');
    expect(inv.inactiveDefaults).toContain('.env');
    expect(inv.activeDefaults).not.toContain('.env');
  });

  it('restoreDefaultPatterns reativa default', () => {
    removeIgnorePatterns(['.env'], cwd);
    restoreDefaultPatterns(['.env'], cwd);
    const inv = getIgnoreInventory(cwd);
    expect(inv.activeDefaults).toContain('.env');
    expect(inv.inactiveDefaults).not.toContain('.env');
  });

  it('não duplica padrão já existente', () => {
    addIgnorePatterns(['dist/'], cwd);
    const again = addIgnorePatterns(['dist/'], cwd);
    expect(again).toEqual([]);
  });
});
