import { buildIgnoreSuggestPrompt } from '../src/ignore/promptBuilder.js';
import { buildCommitPrompt } from '../src/commit/promptBuilder.js';

describe('buildIgnoreSuggestPrompt', () => {
  it('inclui arquivos e regras de saída', () => {
    const prompt = buildIgnoreSuggestPrompt(['.env', 'dist/a.js', 'src/app.js']);
    expect(prompt).toContain('.env');
    expect(prompt).toContain('dist/a.js');
    expect(prompt).toContain('Máximo 20 linhas');
    expect(prompt).toContain('NÃO sugira código-fonte normal');
  });

  it('lida com lista vazia', () => {
    const prompt = buildIgnoreSuggestPrompt([]);
    expect(prompt).toContain('(lista vazia)');
  });

  it('limita a 250 paths no prompt', () => {
    const many = Array.from({ length: 300 }, (_, i) => `f${i}.txt`);
    const prompt = buildIgnoreSuggestPrompt(many);
    expect(prompt).toContain('f0.txt');
    expect(prompt).toContain('f249.txt');
    expect(prompt).not.toContain('f299.txt');
  });
});

describe('buildCommitPrompt — regressão', () => {
  it('pede formato ---BODY---', () => {
    expect(buildCommitPrompt('+x')).toContain('---BODY---');
  });
});
