/**
 * Monta o prompt para a IA gerar documentação.
 *
 * @param {string} diff - O diff sanitizado
 * @param {string} docType - 'readme' ou 'changelog'
 * @param {string} existingContent - Conteúdo atual do arquivo (se existir)
 * @param {string} projectContext - Contexto do projeto (estrutura + arquivos principais) quando não há diff
 * @returns {string}
 */
export function buildDocsPrompt(diff, docType, existingContent = '', projectContext = '') {
  const typeLabel = docType === 'changelog' ? 'um changelog' : 'um README';
  const hasExisting = existingContent.trim().length > 0;
  const hasDiff = diff && diff.trim() !== '';

  return `Você é um assistente de documentação. ${hasExisting ? 'ATUALIZE o documento existente' : 'Gere um novo documento'} em português com base nas informações abaixo.

${hasExisting ? `
Documento atual (${docType === 'changelog' ? 'CHANGELOG.md' : 'README.md'}):
\`\`\`
${existingContent}
\`\`\`

ATUALIZE este documento considerando as informações abaixo. Preserve as seções e informações que ainda são relevantes. Adicione, remova ou modifique apenas o que for necessário.
` : ''}

${projectContext ? `
Contexto do projeto (estrutura de diretórios e arquivos principais):
${projectContext}
` : ''}

Alterações recentes (diff):
\`\`\`
${hasDiff ? diff : 'Nenhuma alteração detectada'}
\`\`\`

${docType === 'changelog' ? `
Formato do changelog:
# Changelog
## [versão ou data]
### Adicionado
- [novas funcionalidades]
### Alterado
- [mudanças]
### Corrigido
- [bugs corrigidos]
` : `
Formato do README:
# [Nome do Projeto]
[Descrição]
## Funcionalidades
- [lista]
## Instalação
[passos]
## Uso
[como usar]
`}

Regras:
1. ${hasExisting ? 'ATUALIZE o documento existente — não o reescreva do zero' : 'Gere o documento baseado nas informações fornecidas'}
2. Não invente funcionalidades que não estão no código
3. Use português claro
4. Retorne APENAS o conteúdo do documento, sem explicações adicionais`;
}