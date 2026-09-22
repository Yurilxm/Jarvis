import { adfToText } from '../jira/adf.js';

/**
 * Monta o prompt para gerar um relatório de desenvolvimento
 * a partir da issue do Jira + commits do histórico.
 *
 * @param {object} issue - objeto retornado por getIssue() do Jira
 * @param {object[]} commits - lista de commits com { hash, title, body, files, fileCount, diff }
 * @returns {string}
 */
export function buildReportPrompt(issue, commits) {
  const fields = issue.fields || {};
  const title = fields.summary || '(sem título)';
  const status = fields.status?.name || '-';
  const type = fields.issuetype?.name || '-';
  const assignee = fields.assignee?.displayName || 'Não atribuído';
  const reporter = fields.reporter?.displayName || '-';
  const descriptionText = adfToText(fields.description);

  const commitsSection = commits.map((c, i) => {
    const filesList = (c.files || []).map((f) => `  - ${f}`).join('\n');
    return `### Commit ${i + 1}: ${c.hash ? c.hash.slice(0, 7) : '?'}
Título: ${c.title || '(sem título)'}
Corpo: ${c.body || '(sem corpo)'}
Arquivos (${c.fileCount || 0}):
${filesList || '  (não registrado)'}

Diff:
\`\`\`
${c.diff || '(não disponível)'}
\`\`\``;
  }).join('\n\n');

  return `Você é um assistente de documentação técnica. Gere um relatório de desenvolvimento em português, em markdown, para a issue abaixo.

## Contexto da task (Jira)
- Chave: ${issue.key}
- Título: ${title}
- Tipo: ${type}
- Status: ${status}
- Responsável: ${assignee}
- Repórter: ${reporter}

Descrição da task:
"""
${descriptionText || '(sem descrição)'}
"""

## Commits realizados para esta task (${commits.length})

${commitsSection}

## Formato do relatório

# ${issue.key} — ${title}

## Objetivo
[reformule o objetivo da task em 2-3 frases claras, com base na descrição da task. Se a descrição já estiver clara, pode reaproveitar — mas reescreva de forma objetiva.]

## O que foi entregue
[agrupe as entregas por tema quando possível. Seja específico e cite arquivos/módulos quando relevante. Use os commits e diffs acima como fonte.]

## Como validar / Testar
[se houver evidência nos commits/diffs, descreva passos de teste/validação. Se não houver, omita esta seção.]

## Observações
[se houver algo relevante — decisões técnicas, pendências, impacto em outras áreas. Se não houver, omita esta seção.]

Regras:
1. Baseie-se APENAS nas informações fornecidas (descrição do Jira + commits + diffs)
2. Não invente funcionalidades que não têm evidência nos diffs
3. Português claro, tom técnico mas objetivo
4. Retorne APENAS o markdown do relatório, sem explicações adicionais`;
}