import { sanitizeDiff, filterSensitiveFiles, isSensitiveFile } from '../src/commit/sanitize.js';

describe('sanitizeDiff', () => {
  it('retorna diff limpo sem warnings quando não há secrets', () => {
    const diff = '+const x = 1;\n+console.log(x);';
    const { sanitized, warnings } = sanitizeDiff(diff);
    expect(sanitized).toBe(diff);
    expect(warnings).toHaveLength(0);
  });

  it('remove private key PEM', () => {
    const diff = '+-----BEGIN RSA PRIVATE KEY-----\n+MIIE...\n+-----END RSA PRIVATE KEY-----';
    const { sanitized, warnings } = sanitizeDiff(diff);
    expect(sanitized).toContain('[REMOVIDO - CONTEÚDO SENSÍVEL]');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('remove token GitHub ghp_', () => {
    const token = `ghp_${'a'.repeat(36)}`;
    const { sanitized, warnings } = sanitizeDiff(`+token=${token}`);
    expect(sanitized).not.toContain(token);
    expect(sanitized).toContain('[REMOVIDO - CONTEÚDO SENSÍVEL]');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('remove api_key com valor longo entre aspas', () => {
    const diff = `+api_key = "${'x'.repeat(24)}"`;
    const { sanitized, warnings } = sanitizeDiff(diff);
    expect(warnings.length).toBeGreaterThan(0);
    expect(sanitized).toContain('[REMOVIDO - CONTEÚDO SENSÍVEL]');
  });

  it('remove chave estilo AQ. (Gemini)', () => {
    const key = `AQ.${'Ab'.repeat(15)}`;
    const { sanitized } = sanitizeDiff(`+GEMINI=${key}`);
    expect(sanitized).not.toContain(key);
  });
});

describe('filterSensitiveFiles / isSensitiveFile', () => {
  it('marca .env como sensível', () => {
    expect(isSensitiveFile('.env')).toBe(true);
    expect(isSensitiveFile('src/app.js')).toBe(false);
  });

  it('separa safe e blocked', () => {
    const { safe, blocked } = filterSensitiveFiles([
      'src/cli.js',
      '.env',
      'readme.md',
      'secret-config.json',
    ]);
    expect(safe).toEqual(expect.arrayContaining(['src/cli.js', 'readme.md']));
    expect(blocked).toEqual(expect.arrayContaining(['.env', 'secret-config.json']));
  });
});
