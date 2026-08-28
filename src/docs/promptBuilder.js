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

  return `Você é um assistente de documentação. ${hasExisting ? 'MELHORE o documento existente' : 'Gere um novo documento'} em português com base nas informações abaixo.

${hasExisting ? `
Documento atual (${docType === 'changelog' ? 'CHANGELOG.md' : 'README.md'}):
\`\`\`
${existingContent}
\`\`\`

Use o documento atual como base para entender o que já está documentado e o estilo adotado. Em seguida, PRODUZA UMA VERSÃO APRIMORADA e mais completa, aproveitando as informações abaixo e o contexto do projeto. Você pode reorganizar seções, reescrever trechos, expandir onde faltar detalhes e melhorar a clareza. O objetivo é entregar um documento melhor que o atual, sem perder informações relevantes já existentes. NÃO se limite a apenas adicionar seções novas — melhore o conjunto como um todo.
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
Formato do README (seções sugeridas — inclua apenas as que fizerem sentido com base no contexto; se não houver informação, omita a seção sem inventar):

# [Nome do Projeto]

## Visão Geral
[2-4 frases explicando, em linguagem simples e não-técnica, o que este projeto
FAZ e para QUEM — como se estivesse explicando para alguém que não é
desenvolvedor. Infira isso a partir dos nomes de modelos, rotas e módulos
encontrados no código (ex: se existem "Product", "Cart", "Order", "Payment",
isso é uma loja online — descreva o fluxo de compra que ela oferece).]

## Tecnologias
- [principais linguagens, frameworks e bibliotecas]

## Funcionalidades
- [recursos principais, agrupados por módulo/app quando possível — use os
nomes reais das pastas/apps detectadas no contexto do projeto abaixo]

## Instalação
[passos para rodar localmente]

## Configuração
[variáveis de ambiente, arquivos .env.example, etc., se existirem]

## Testes
[como rodar os testes, se houver indícios]

## Estrutura do Projeto
[liste os módulos/apps identificados e uma frase sobre a responsabilidade
de cada um — não apenas a árvore de pastas crua]

## Deploy
[se houver Docker, docker-compose ou instruções de deploy]

## Contribuição
[se houver orientações]

## Licença
[se houver arquivo LICENSE]
`}

Regras:
1. ${hasExisting ? 'MELHORE o documento existente, usando-o como base. Você pode reorganizar, reescrever e expandir seções livremente, desde que não perca informações relevantes já presentes.' : 'Gere o documento baseado nas informações fornecidas'}
2. Não invente funcionalidades que não estão no código
3. Use português claro
4. Retorne APENAS o conteúdo do documento, sem explicações adicionais
5. NÃO imprima a palavra "undefined" em nenhuma circunstância
6. Na seção "Visão Geral", escreva para uma pessoa não-técnica (ex: o dono do
   negócio) — nada de jargão de código ali. Infira o propósito a partir dos
   nomes de modelos/rotas encontrados, sem inventar funcionalidades que não
   têm evidência no código.`;
}