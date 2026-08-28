import { buildCommitPrompt } from '../src/commit/promptBuilder.js';
import { buildReviewPrompt } from '../src/review/promptBuilder.js';
import { buildDocsPrompt } from '../src/docs/promptBuilder.js';

describe('buildCommitPrompt', () => {
  it('deve incluir o diff no prompt', () => {
    const prompt = buildCommitPrompt('diff de teste');
    expect(prompt).toContain('diff de teste');
  });

  it('deve mostrar mensagem padrão quando diff vazio', () => {
    const prompt = buildCommitPrompt('');
    expect(prompt).toContain('Nenhuma alteração detectada');
  });

  it('deve incluir regras de Conventional Commits', () => {
    const prompt = buildCommitPrompt('teste');
    expect(prompt).toContain('Conventional Commits');
    expect(prompt).toContain('---BODY---');
  });
});

describe('buildReviewPrompt', () => {
  it('deve incluir o diff no prompt', () => {
    const prompt = buildReviewPrompt('diff de teste');
    expect(prompt).toContain('diff de teste');
  });

  it('deve incluir seções de análise', () => {
    const prompt = buildReviewPrompt('teste');
    expect(prompt).toContain('Resumo');
    expect(prompt).toContain('Pontos positivos');
    expect(prompt).toContain('Pontos de atenção');
    expect(prompt).toContain('Sugestões');
  });

  it('deve instruir a não modificar código', () => {
    const prompt = buildReviewPrompt('teste');
    expect(prompt).toContain('NÃO modifique código');
  });
});

describe('buildDocsPrompt', () => {
  it('deve incluir o diff no prompt', () => {
    const prompt = buildDocsPrompt('diff de teste', 'readme', '');
    expect(prompt).toContain('diff de teste');
  });

  it('deve incluir conteúdo existente quando fornecido', () => {
    const prompt = buildDocsPrompt('diff', 'readme', 'README existente');
    expect(prompt).toContain('README existente');
    expect(prompt).toContain('MELHORE o documento existente');
  });

  it('deve gerar novo quando não há conteúdo existente', () => {
    const prompt = buildDocsPrompt('diff', 'readme', '');
    expect(prompt).toContain('Gere um novo documento');
  });

  it('deve usar formato changelog quando docType é changelog', () => {
    const prompt = buildDocsPrompt('diff', 'changelog', '');
    expect(prompt).toContain('Adicionado');
    expect(prompt).toContain('Alterado');
    expect(prompt).toContain('Corrigido');
  });
});