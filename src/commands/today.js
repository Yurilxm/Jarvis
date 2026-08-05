import { isGitRepo, getGitStatus } from '../git/status.js';
import { getCurrentBranch, listBranches } from '../git/branch.js';
import { PROTECTED_BRANCH } from '../config/branches.js';
import { getProjectConfig } from '../config/project.js';
import { getRepoInfo, listPullRequests } from '../github/pr.js';
import { listIssues } from '../jira/client.js';
import { GITHUB_TOKEN } from '../config/env.js';
import { select } from '@inquirer/prompts';
import {
  printBanner,
  printBox,
  info,
  chalk,
  muted,
} from '../ui.js';

export async function runToday() {
  printBanner();
  info('Preparando seu resumo do dia...\n');

  // ── Status do repositório local ──────────────────────────
  if (isGitRepo()) {
    const branch = getCurrentBranch();
    const status = getGitStatus();
    const total = status.staged.length + status.modified.length + status.deleted.length + status.untracked.length;

    const branchLabel = branch === PROTECTED_BRANCH
      ? chalk.yellow(`${branch} (protegida)`)
      : chalk.green(branch);

    const statusLines = [
      `${chalk.bold('Branch')}  ${branchLabel}`,
      total === 0
        ? `${chalk.bold('Status')}  ${chalk.green('árvore limpa')}`
        : `${chalk.bold('Status')}  ${chalk.yellow(`${total} arquivo(s) alterado(s)`)}`,
    ];

    if (total > 0) {
      if (status.staged.length) {
        statusLines.push(muted('  staged:'));
        for (const f of status.staged) statusLines.push(muted(`    + ${f}`));
      }
      if (status.modified.length) {
        statusLines.push(muted('  modificados:'));
        for (const f of status.modified) statusLines.push(muted(`    ~ ${f}`));
      }
      if (status.untracked.length) {
        statusLines.push(muted('  não rastreados:'));
        for (const f of status.untracked) statusLines.push(muted(`    ? ${f}`));
      }
    }

    printBox(statusLines.join('\n'), { title: 'repositório' });
  } else {
    printBox('Nenhum repositório Git encontrado.', { title: 'repositório' });
  }

  // ── Jira ────────────────────────────────────────────────
  try {
    const projectKey = getProjectConfig('jira.projectKey');
    if (projectKey) {
      const data = await listIssues(projectKey, `project=${projectKey} AND status not in (Done,Closed,Cancelled,Concluído) ORDER BY updated DESC`);
      const issues = data.issues || [];

      if (issues.length === 0) {
        printBox('Nenhuma issue ativa.', { title: 'jira' });
      } else {
        const lines = [];
        for (const issue of issues.slice(0, 10)) {
          const key = issue.key;
          const summary = issue.fields.summary;
          const statusName = issue.fields.status.name;
          const assignee = issue.fields.assignee?.displayName || 'Não atribuído';
          const priority = issue.fields.priority?.name || '-';
          const type = issue.fields.issuetype.name;
          
          const isInProgress = statusName === 'In Progress' || statusName === 'Em andamento';
          const statusColor = isInProgress ? chalk.yellow : (statusName === 'Tarefas pendentes' ? chalk.blue : muted);
          
          lines.push(`${chalk.green(key)}  ${chalk.bold(summary)}`);
          lines.push(muted(`  ${type} · ${statusColor(statusName)} · Prioridade: ${priority} · ${assignee}`));
        }
        if (issues.length > 10) {
          lines.push(muted(`  ... e mais ${issues.length - 10} issue(s)`));
        }
        printBox(lines.join('\n'), { title: `jira · ${issues.length} issue(s) ativa(s)` });
      }
    }
  } catch {
    // Jira não configurado ou erro
  }

  // ── Pull Requests ────────────────────────────────────────
  try {
    const repoInfo = getRepoInfo();
    if (repoInfo.owner && repoInfo.repo && GITHUB_TOKEN) {
      const prs = await listPullRequests(repoInfo.owner, repoInfo.repo);
      if (prs.length === 0) {
        printBox('Nenhuma PR aberta.', { title: 'pull requests' });
      } else {
        const lines = [];
        for (const pr of prs.slice(0, 5)) {
          const hasConflict = pr.mergeable === false;
          const conflictLabel = hasConflict ? chalk.red(' (conflito)') : '';
          lines.push(`${chalk.green(`#${pr.number}`)}  ${chalk.bold(pr.title)}${conflictLabel}`);
          lines.push(muted(`  ${pr.head.ref} → ${pr.base.ref} · por ${pr.user.login}`));
        }
        if (prs.length > 5) {
          lines.push(muted(`  ... e mais ${prs.length - 5} PR(s)`));
        }
        printBox(lines.join('\n'), { title: `pull requests · ${prs.length} aberta(s)` });
      }
    }
  } catch {
    // GitHub não configurado ou erro
  }

  // ── Menu interativo ──────────────────────────────────────
  console.log('');
  const { runCommitFlow } = await import('../commit/flow.js');
  const { showStatus } = await import('./status.js');
  const { jiraList } = await import('../jira/flow.js');
  const { prList } = await import('../pr/flow.js');

  const action = await select({
    message: 'O que deseja fazer agora?',
    choices: [
      { name: 'Ver status detalhado', value: 'status' },
      { name: 'Commitar alterações', value: 'commit' },
      { name: 'Ver todas as issues no Jira', value: 'jira' },
      { name: 'Ver todas as PRs', value: 'pr' },
      { name: 'Sair', value: 'exit' },
    ],
  });

  if (action === 'exit') return;

  if (action === 'status') showStatus();
  if (action === 'commit') await runCommitFlow();
  if (action === 'jira') await jiraList('active');
  if (action === 'pr') await prList();
}