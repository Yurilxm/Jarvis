import { listIssues, getIssue, getTransitions, transitionIssue, createIssue, getAssignableUsers } from './client.js';
import { getJiraConfig, getJiraBaseUrl, getJiraAuthHeader } from '../config/jira.js';
import { getProjectConfig } from '../config/project.js';
import { confirm, input, select } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
import { askAI } from '../ai/client.js';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  section,
  spinner,
  chalk,
  accent,
  muted,
} from '../ui.js';

// Cache em memória para lista de assignees (vive apenas durante a sessão)
let assigneeCache = null;
let assigneeCacheProject = null;

function requireConfig() {
  getJiraConfig();
}

function requireProjectConfig() {
  const projectKey = getProjectConfig('jira.projectKey');
  const projectId = getProjectConfig('jira.projectId');
  if (!projectKey || !projectId) {
    error('Integração com Jira não configurada neste projeto.');
    dim('Crie um arquivo .jarvis-dev.json na raiz do projeto com:');
    dim('  "jira": { "projectKey": "SDG", "projectId": "10033" }');
    process.exit(1);
  }
  return { projectKey, projectId };
}

async function getAssignees(projectKey) {
  if (assigneeCache && assigneeCacheProject === projectKey) {
    return assigneeCache;
  }
  const data = await getAssignableUsers(projectKey);
  assigneeCache = data;
  assigneeCacheProject = projectKey;
  return data;
}

// ─── ADF → texto formatado ─────────────────────────────────

function adfToText(adf) {
  if (!adf || !adf.content) return '';

  function renderNode(node, indent = 0, listInfo = null) {
    if (!node) return '';

    switch (node.type) {
      case 'text':
        return node.text || '';
      case 'hardBreak':
        return '\n';
      case 'paragraph': {
        const text = (node.content || []).map(n => renderNode(n)).join('');
        return text;
      }
      case 'heading': {
        const text = (node.content || []).map(n => renderNode(n)).join('');
        return text;
      }
      case 'bulletList': {
        return (node.content || [])
          .map(item => renderNode(item, indent + 1, { type: 'bullet' }))
          .join('\n');
      }
      case 'orderedList': {
        return (node.content || [])
          .map((item, i) => renderNode(item, indent + 1, { type: 'ordered', index: i + 1 }))
          .join('\n');
      }
      case 'listItem': {
        const prefix = '  '.repeat(indent - 1) + (
          listInfo?.type === 'ordered' ? `${listInfo.index}. ` : '• '
        );
        const text = (node.content || []).map(n => renderNode(n, indent)).join('\n');
        return prefix + text.trim();
      }
      case 'codeBlock': {
        const text = (node.content || []).map(n => renderNode(n)).join('');
        return text;
      }
      case 'blockquote': {
        const text = (node.content || []).map(n => renderNode(n, indent)).join('\n');
        return text.split('\n').map(line => `  ${line}`).join('\n');
      }
      default:
        if (node.content) {
          return node.content.map(n => renderNode(n, indent, listInfo)).join('');
        }
        return '';
    }
  }

  const blocks = adf.content.map(node => renderNode(node));
  return blocks.filter(b => b.trim() !== '').join('\n\n');
}

// ─── list ─────────────────────────────────────────────────

export async function jiraList(filter = 'active') {
  const { projectKey } = requireProjectConfig();
  requireConfig();

  let jql = `project=${projectKey} ORDER BY updated DESC`;
  let label = '';

  if (filter === 'done') {
    jql = `project=${projectKey} AND status in (Done,Concluído) ORDER BY updated DESC`;
    label = 'concluídas';
  } else if (filter === 'all') {
    jql = `project=${projectKey} ORDER BY updated DESC`;
    label = 'todas';
  } else {
    jql = `project=${projectKey} AND status not in (Done,Closed,Cancelled,Concluído) ORDER BY updated DESC`;
    label = 'ativas';
  }

  const spin = spinner(`Buscando issues ${label}...`);
  spin.start();

  try {
    const data = await listIssues(projectKey, jql);
    spin.succeed(`${data.issues?.length || 0} issues ${label} encontradas`);

    if (!data.issues || data.issues.length === 0) {
      info(`Nenhuma issue ${label}.`);
      return;
    }

    blank();
    for (const issue of data.issues) {
      const key = issue.key;
      const summary = issue.fields.summary;
      const status = issue.fields.status.name;
      const priority = issue.fields.priority?.name || '-';
      const type = issue.fields.issuetype.name;
      const assignee = issue.fields.assignee?.displayName || 'Não atribuído';

      const isInProgress = status === 'In Progress' || status === 'Em andamento';
      const statusColor = isInProgress ? chalk.yellow : muted;

      console.log(`  ${chalk.green(key)}  ${chalk.bold(summary)}`);
      console.log(muted(`     ${type} · ${statusColor(status)} · Prioridade: ${priority} · ${assignee}`));
      console.log('');
    }
  } catch (err) {
    spin.fail('Erro ao buscar issues');
    error(err.message);
  }
}

// ─── view ─────────────────────────────────────────────────

export async function jiraView(issueKey) {
  requireConfig();

  const spin = spinner(`Buscando ${issueKey}...`);
  spin.start();

  try {
    const issue = await getIssue(issueKey);
    spin.succeed(issueKey);

    const { fields } = issue;

    let descText = '';
    if (fields.description) {
      if (typeof fields.description === 'string') {
        descText = fields.description;
      } else if (fields.description.content) {
        descText = adfToText(fields.description);
      }
    }

    const info = [
      `${chalk.bold('Título')}      ${fields.summary}`,
      `${chalk.bold('Status')}      ${fields.status.name}`,
      `${chalk.bold('Prioridade')}  ${fields.priority?.name || '-'}`,
      `${chalk.bold('Tipo')}        ${fields.issuetype.name}`,
      `${chalk.bold('Responsável')} ${fields.assignee?.displayName || 'Não atribuído'}`,
      `${chalk.bold('Repórter')}    ${fields.reporter?.displayName || '-'}`,
      `${chalk.bold('Criado em')}   ${new Date(fields.created).toLocaleString('pt-BR')}`,
      `${chalk.bold('Atualizado')}  ${new Date(fields.updated).toLocaleString('pt-BR')}`,
    ];

    info.push('');
    info.push(`${chalk.bold('Descrição')}`);
    if (descText) {
      info.push(muted(descText));
    } else {
      info.push(muted('Nenhuma descrição.'));
    }

    blank();
    printBox(info.join('\n'), { title: `${issueKey} · ${fields.issuetype.name}` });

    blank();
  } catch (err) {
    spin.fail('Erro ao buscar issue');
    error(err.message);
  }
}

// ─── status ───────────────────────────────────────────────

export async function jiraStatus(issueKey) {
  requireConfig();

  const spin = spinner('Buscando transições...');
  spin.start();

  try {
    const issue = await getIssue(issueKey);
    const transitions = await getTransitions(issueKey);
    spin.succeed();

    blank();
    printBox(
      `${chalk.bold(issueKey)} — ${chalk.bold(issue.fields.summary)}\n${muted('Status atual:')} ${chalk.yellow(issue.fields.status.name)}`,
      { title: 'status' }
    );

    if (transitions.transitions && transitions.transitions.length > 0) {
      section('Transições disponíveis');
      for (const t of transitions.transitions) {
        console.log(`  ${chalk.green(t.id)}  ${t.name} → ${t.to.name}`);
      }
      blank();
    } else {
      dim('Nenhuma transição disponível.');
    }
  } catch (err) {
    spin.fail('Erro');
    error(err.message);
  }
}

// ─── move ─────────────────────────────────────────────────

export async function jiraMove(issueKey) {
  requireConfig();

  try {
    const issue = await getIssue(issueKey);
    const transitions = await getTransitions(issueKey);

    if (!transitions.transitions || transitions.transitions.length === 0) {
      info('Nenhuma transição disponível.');
      return;
    }

    blank();
    printBox(
      `${chalk.bold(issueKey)} — ${issue.fields.summary}\n${muted('Status atual:')} ${chalk.yellow(issue.fields.status.name)}`,
      { title: 'mover issue' }
    );

    section('Para onde deseja mover?');

    const choice = await select({
      message: 'Selecione o destino:',
      choices: transitions.transitions.map(t => ({
        name: `${t.name} → ${chalk.green(t.to.name)}`,
        value: t.id,
      })),
    });

    const spin = spinner('Movendo...');
    spin.start();
    await transitionIssue(issueKey, choice);
    spin.succeed(`${issueKey} movida com sucesso!`);

    const chosenTransition = transitions.transitions.find(t => t.id === choice);
    if (chosenTransition && chosenTransition.to.name.toLowerCase().includes('andamento')) {
      const shouldBranch = await confirm({
        message: `Criar branch feature/${issueKey}-descricao?`,
        default: false,
      });

      if (shouldBranch) {
        const branchSuffix = await input({
          message: 'Descrição curta para a branch:',
          default: issueKey.toLowerCase(),
          validate: (v) => v.trim().length > 0 ? true : 'Informe uma descrição.',
        });

        const branchName = `feature/${issueKey}-${branchSuffix.replace(/\s+/g, '-').toLowerCase()}`;

        try {
          execSync(`git checkout -b ${branchName}`, { encoding: 'utf-8', stdio: 'inherit' });
          success(`Branch '${branchName}' criada!`);
        } catch (err) {
          error(`Erro ao criar branch: ${err.message}`);
        }
      }
    }
  } catch (err) {
    error(err.message);
  }
}

// ─── create ────────────────────────────────────────────────

export async function jiraCreate() {
  const { projectKey, projectId } = requireProjectConfig();
  requireConfig();

  printBanner();
  info('Criar nova task no Jira');

  // ── Título (com sugestão da IA) ──────────────────────────
  const useAIForTitle = await confirm({
    message: 'Usar IA para sugerir título e descrição?',
    default: false,
  });

  let summary = '';
  let description = '';

  if (useAIForTitle) {
    const ideia = await input({
      message: 'Descreva a ideia da task em poucas palavras:',
      validate: (v) => v.trim().length > 0 ? true : 'Descreva a ideia.',
    });

    const aiSpin = spinner('Gerando título e descrição com IA...');
    aiSpin.start();
    try {
      const prompt = `Você é um assistente de projeto. Com base na ideia abaixo, gere um título curto (máx 100 caracteres) e uma descrição detalhada (2-3 frases) para uma task do Jira.

Ideia: ${ideia}

Formato da resposta:
TÍTULO: <título aqui>
DESCRIÇÃO: <descrição aqui>`;

      const response = await askAI(prompt);
      const titleMatch = response.match(/TÍTULO:\s*(.+)/);
      const descMatch = response.match(/DESCRIÇÃO:\s*([\s\S]+)/);

      summary = titleMatch ? titleMatch[1].trim() : ideia;
      description = descMatch ? descMatch[1].trim() : '';

      aiSpin.succeed('Sugestão gerada pela IA');
    } catch {
      aiSpin.fail('IA indisponível, usando ideia como título');
      summary = ideia;
    }
  }

  if (!summary) {
    summary = await input({
      message: 'Título da task:',
      validate: (v) => v.trim().length > 0 ? true : 'Título é obrigatório.',
    });
  }

  if (!description) {
    description = await input({
      message: 'Descrição (opcional):',
    });
  }

  // ── Designar responsável (dinâmico da API) ──────────────
  const assignToMe = await confirm({
    message: 'Atribuir a você?',
    default: true,
  });

  let assigneeId = null;
  if (assignToMe) {
    // Buscar accountId do usuário logado
    try {
      const meResp = await fetch(`${getJiraBaseUrl()}/rest/api/3/myself`, {
        headers: { 'Authorization': getJiraAuthHeader(), 'Accept': 'application/json' }
      });
      const meData = await meResp.json();
      assigneeId = meData.accountId;
    } catch {
      // fallback: não atribuir
    }
  } else {
    // Buscar lista de assignees dinamicamente
    const spinUsers = spinner('Buscando usuários do projeto...');
    spinUsers.start();
    try {
      const users = await getAssignees(projectKey);
      spinUsers.succeed(`${users.length} usuários encontrados`);

      const choices = users
        .filter(u => u.active)
        .map(u => ({ name: u.displayName, value: u.accountId }));
      choices.push({ name: 'Não atribuir', value: null });

      const assignChoice = await select({
        message: 'Atribuir para:',
        choices,
      });
      assigneeId = assignChoice;
    } catch {
      spinUsers.fail('Não foi possível buscar usuários');
    }
  }

  // ── Status inicial ──────────────────────────────────────
  const initialStatus = await select({
    message: 'Status inicial:',
    choices: [
      { name: 'Tarefas pendentes (To Do)', value: 'todo' },
      { name: 'Em andamento (In Progress)', value: 'inprogress' },
      { name: 'Concluído (Done)', value: 'done' },
    ],
  });

  const confirmed = await confirm({
    message: 'Criar task?',
    default: true,
  });

  if (!confirmed) {
    info('Cancelado.');
    return;
  }

  const spin = spinner('Criando task...');
  spin.start();

  try {
    // Buscar tipo de issue válido para este projeto
    const typesResp = await fetch(
      `${getJiraBaseUrl()}/rest/api/3/issue/createmeta/${projectId}/issuetypes`,
      { headers: { 'Authorization': getJiraAuthHeader(), 'Accept': 'application/json' } }
    );
    const typesData = await typesResp.json();
    const issueTypeName = getProjectConfig('jira.issueType', 'Tarefa');
    const tarefaType = typesData.issueTypes.find(t => t.name === issueTypeName);

    if (!tarefaType) {
      throw new Error(`Nenhum tipo "${issueTypeName}" disponível para este projeto.`);
    }

    const issue = await createIssue(projectId, summary.trim(), description.trim() || undefined, tarefaType.id, assigneeId);
    spin.succeed(`Task ${issue.key} criada com sucesso!`);

    blank();
    printBox(
      `${chalk.bold(issue.key)} — ${summary}`,
      { title: 'task criada' }
    );

    // Mover para o status escolhido
    if (initialStatus !== 'todo') {
      const transitions = await getTransitions(issue.key);
      let targetTransition;

      if (initialStatus === 'inprogress') {
        targetTransition = transitions.transitions?.find(
          t => t.to.name.toLowerCase().includes('andamento')
        );
      } else if (initialStatus === 'done') {
        targetTransition = transitions.transitions?.find(
          t => t.to.name.toLowerCase().includes('concluído') || t.to.name.toLowerCase().includes('done')
        );
      }

      if (targetTransition) {
        await transitionIssue(issue.key, targetTransition.id);
        success(`Task ${issue.key} movida para "${targetTransition.to.name}"!`);
      }
    }

    // Criar branch se foi para "Em andamento"
    if (initialStatus === 'inprogress') {
      const shouldBranch = await confirm({
        message: `Criar branch feature/${issue.key}-descricao?`,
        default: false,
      });

      if (shouldBranch) {
        const branchSuffix = await input({
          message: 'Descrição curta para a branch:',
          default: issue.key.toLowerCase(),
          validate: (v) => v.trim().length > 0 ? true : 'Informe uma descrição.',
        });

        const branchName = `feature/${issue.key}-${branchSuffix.replace(/\s+/g, '-').toLowerCase()}`;

        try {
          execSync(`git checkout -b ${branchName}`, { encoding: 'utf-8', stdio: 'inherit' });
          success(`Branch '${branchName}' criada!`);
        } catch (err) {
          error(`Erro ao criar branch: ${err.message}`);
        }
      }
    }
  } catch (err) {
    spin.fail('Erro ao criar task');
    error(err.message);
  }
}