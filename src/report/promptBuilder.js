import { adfToText } from '../jira/adf.js';

/**
 * Monta o prompt para gerar um relatório de desenvolvimento.
 *
 * Aceita dois modos:
 *  - Por issue: `issue` é o objeto do Jira retornado por getIssue().
 *  - Por período (--since): `issue` é null, e o relatório usa só os commits.
 *
 * @param {object|null} issue - objeto do Jira (ou null para modo período)
 * @param {object[]} commits - lista de commits com { hash, title, body, files, fileCount, diff, at, branch, jiraIssue }
 * @returns {string}
 */
export function buildReportPrompt(issue, commits) {
  const hasIssue = Boolean(issue);

  let contextSection;
  let titleLine;
  let objectiveLine;

  if (hasIssue) {
    const fields = issue.fields || {};
    const title = fields.summary || '(sem título)';
    const status = fields.status?.name || '-';
    const type = fields.issuetype?.name || '-';
    const assignee = fields.assignee?.displayName || 'Não atribuído';
    const reporter = fields.reporter?.displayName || '-';
    const descriptionText = adfToText(fields.description);

    contextSection = `## Contexto da task (Jira)
- Chave: ${issue.key}
- Título: ${title}
- Tipo: ${type}
- Status: ${status}
- Responsável: ${assignee}
- Repórter: ${reporter}

Descrição da task:
"""
${descriptionText || '(sem descrição)'}
"""`;

    titleLine = `# ${issue.key} — ${title}`;
    objectiveLine = '## Objetivo\n[reformule o objetivo da task em 2-3 frases claras, com base na descrição da task. Se a descrição já estiver clara, pode reaproveitar — mas reescreva de forma objetiva.]';
  } else {
    contextSection = `## Contexto
Relatório de desenvolvimento por período (sem issue específica do Jira). Os commits abaixo cobrem um intervalo de tempo e podem tocar diferentes áreas do projeto.`;

    titleLine = '# Relatório de desenvolvimento';
    objectiveLine = '## Resumo do período\n[resuma em 2-3 frases o que foi feito no período, com base nos commits. Se houver temas recorrentes, agrupe-os.]';
  }

  const commitsSection = commits.map((c, i) => {
    const filesList = (c.files || []).map((f) => `  - ${f}`).join('\n');
    const branchLine = c.branch ? `Branch: ${c.branch}\n` : '';
    const jiraLine = c.jiraIssue ? `Issue: ${c.jiraIssue}\n` : '';
    const dateLine = c.at ? `Data: ${new Date(c.at).toLocaleString('pt-BR')}\n` : '';

    return `### Commit ${i + 1}: ${c.hash ? c.hash.slice(0, 7) : '?'}
${dateLine}${branchLine}${jiraLine}Título: ${c.title || '(sem título)'}
Corpo: ${c.body || '(sem corpo)'}
Arquivos (${c.fileCount || 0}):
${filesList || '  (não registrado)'}

Diff:
\`\`\`
${c.diff || '(não disponível)'}
\`\`\``;
  }).join('\n\n');

  return `Você é um assistente de documentação técnica. Gere um relatório de desenvolvimento em português, em markdown, com base nas informações abaixo.

${contextSection}

## Commits (${commits.length})

${commitsSection}

## Formato do relatório

${titleLine}

${objectiveLine}

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