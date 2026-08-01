import { listIssues, getIssue, getTransitions, transitionIssue } from './client.js';
import { getJiraConfig } from '../config/jira.js';
import { confirm, input, select } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
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

function requireConfig() {
  getJiraConfig(); // valida se existe, senão encerra
}

// ─── list ─────────────────────────────────────────────────

export async function jiraList() {
  requireConfig();

  const spin = spinner('Buscando issues...');
  spin.start();

  try {
    const data = await listIssues();
    spin.succeed(`${data.issues?.length || 0} issues encontradas`);

    if (!data.issues || data.issues.length === 0) {
      info('Nenhuma issue ativa atribuída a você.');
      return;
    }

    blank();
    for (const issue of data.issues) {
      const key = issue.key;
      const summary = issue.fields.summary;
      const status = issue.fields.status.name;
      const priority = issue.fields.priority?.name || '-';
      const type = issue.fields.issuetype.name;

      const statusColor = status === 'In Progress' ? chalk.yellow : muted;

      console.log(`  ${chalk.green(key)}  ${chalk.bold(summary)}`);
      console.log(muted(`     ${type} · ${statusColor(status)} · Prioridade: ${priority}`));
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

    blank();
    printBox(
      [
        `${chalk.bold('Título')}      ${fields.summary}`,
        `${chalk.bold('Status')}      ${fields.status.name}`,
        `${chalk.bold('Prioridade')}  ${fields.priority?.name || '-'}`,
        `${chalk.bold('Tipo')}        ${fields.issuetype.name}`,
        `${chalk.bold('Responsável')} ${fields.assignee?.displayName || 'Não atribuído'}`,
        `${chalk.bold('Repórter')}    ${fields.reporter?.displayName || '-'}`,
        `${chalk.bold('Criado em')}   ${new Date(fields.created).toLocaleString('pt-BR')}`,
        `${chalk.bold('Atualizado')}  ${new Date(fields.updated).toLocaleString('pt-BR')}`,
      ].join('\n'),
      { title: `${issueKey} · ${fields.issuetype.name}` }
    );

    if (fields.description) {
      blank();
      dim(fields.description.substring(0, 500));
    }

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

    // Se moveu para "In Progress", pergunta se quer criar branch
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