import { buildReviewPrompt } from '../src/review/promptBuilder.js';
import { buildDocsPrompt } from '../src/docs/promptBuilder.js';

describe('buildReviewPrompt', () => {
  it('inclui diff e seções obrigatórias', () => {
    const prompt = buildReviewPrompt('+fix bug');
    expect(prompt).toContain('+fix bug');
    expect(prompt).toContain('## Resumo');
    expect(prompt).toContain('## Pontos de atenção');
    expect(prompt).toContain('APENAS analisar');
  });

  it('usa placeholder quando diff vazio', () => {
    expect(buildReviewPrompt('')).toContain('Nenhuma alteração detectada');
  });
});

describe('buildDocsPrompt', () => {
  it('gera README novo', () => {
    const prompt = buildDocsPrompt('+feat', 'readme');
    expect(prompt).toContain('Gere um novo documento');
    expect(prompt).toContain('## Instalação');
    expect(prompt).toContain('+feat');
  });

  it('atualiza changelog existente', () => {
    const prompt = buildDocsPrompt('+fix', 'changelog', '# Changelog\n');
    expect(prompt).toContain('ATUALIZE o documento existente');
    expect(prompt).toContain('### Corrigido');
    expect(prompt).toContain('# Changelog');
  });
});
