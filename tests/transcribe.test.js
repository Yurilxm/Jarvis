import fs from 'node:fs';
import path from 'node:path';
import { validateImageFile, SUPPORTED_EXTENSIONS } from '../src/transcribe/ocr.js';
import { ensureGitignoreEntry } from '../src/utils/gitignore.js';
import { makeTempDir, removeTempDir } from './helpers/temp.js';

describe('transcribe — validateImageFile', () => {
  let cwd;

  beforeEach(() => {
    cwd = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(cwd);
  });

  it('retorna erro quando nenhum caminho é informado', () => {
    const r = validateImageFile();
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Informe o caminho/);
  });

  it('retorna erro quando arquivo não existe', () => {
    const r = validateImageFile(path.join(cwd, 'nao-existe.png'));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/não encontrado/i);
  });

  it('aceita arquivos com extensões suportadas', () => {
    const file = path.join(cwd, 'imagem.png');
    fs.writeFileSync(file, 'x');
    const r = validateImageFile(file);
    expect(r.ok).toBe(true);
  });

  it('rejeita extensões não suportadas', () => {
    const file = path.join(cwd, 'arquivo.txt');
    fs.writeFileSync(file, 'x');
    const r = validateImageFile(file);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/não suportada/i);
  });

  it('rejeita diretórios (mesmo com extensão de imagem)', () => {
    const dir = path.join(cwd, 'subdir.png');
    fs.mkdirSync(dir);
    const r = validateImageFile(dir);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/não é um arquivo/i);
  });

  it('lista de extensões suportadas inclui formatos comuns', () => {
    expect(SUPPORTED_EXTENSIONS).toEqual(expect.arrayContaining(['.png', '.jpg', '.jpeg']));
  });
});

describe('gitignore — ensureGitignoreEntry', () => {
  it('cria .gitignore quando não existe', () => {
    const cwd = makeTempDir();
    try {
      const r = ensureGitignoreEntry('transcricoes/', cwd);
      expect(r.created).toBe(true);
      expect(r.added).toBe(true);
      const content = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf-8');
      expect(content).toContain('transcricoes/');
    } finally {
      removeTempDir(cwd);
    }
  });

  it('adiciona entrada quando .gitignore existe sem ela', () => {
    const cwd = makeTempDir();
    try {
      fs.writeFileSync(path.join(cwd, '.gitignore'), 'node_modules/\n');
      const r = ensureGitignoreEntry('transcricoes/', cwd);
      expect(r.added).toBe(true);
      expect(r.created).toBe(false);
      const content = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf-8');
      expect(content).toContain('transcricoes/');
      expect(content).toContain('node_modules/');
    } finally {
      removeTempDir(cwd);
    }
  });

  it('não duplica quando a entrada já existe', () => {
    const cwd = makeTempDir();
    try {
      fs.writeFileSync(path.join(cwd, '.gitignore'), 'transcricoes/\n');
      const r = ensureGitignoreEntry('transcricoes/', cwd);
      expect(r.added).toBe(false);
    } finally {
      removeTempDir(cwd);
    }
  });

  it('reconhece a entrada sem barra final', () => {
    const cwd = makeTempDir();
    try {
      fs.writeFileSync(path.join(cwd, '.gitignore'), 'transcricoes\n');
      const r = ensureGitignoreEntry('transcricoes/', cwd);
      expect(r.added).toBe(false);
    } finally {
      removeTempDir(cwd);
    }
  });
});