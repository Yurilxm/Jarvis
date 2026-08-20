import { getRepoInfo, listPullRequests, getPullRequest, getPullRequestFiles, getPullRequestDiff, approvePullRequest, requestChanges, commentOnPR, mergePullRequest, closePullRequest } from '../github/pr.js';
import { askAI } from '../ai/client.js';
import { getCurrentBranch, hasUncommittedChanges, switchBranch } from '../git/branch.js';
import { getProtectedBranch } from '../config/branches.js';
import { confirm, input } from '@inquirer/prompts';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import logSymbols from 'log-symbols';

function requireRepoInfo() {
  const info = getRepoInfo();
  if (!info.owner || !info.repo) {
    console.error(chalk.red(`${logSymbols.error} Remote 'origin' não encontrado ou não é do GitHub.`));
    process.exit(1);
  }
  return info;
}

// ─── list ─────────────────────────────────────────────────

export async function prList() {
  const { owner, repo } = requireRepoInfo();

  console.log(chalk.blue(`\n${logSymbols.info} Buscando PRs abertas...`));

  const prs = await listPullRequests(owner, repo);

  if (prs.length === 0) {
    console.log(chalk.dim('Nenhuma PR aberta.'));
    return;
  }

  console.log(chalk.bold(`\n${logSymbols.info} Pull Requests abertas (${prs.length}):\n`));

  for (const pr of prs) {
    const hasConflict = pr.mergeable === false;
    const conflictLabel = hasConflict ? chalk.red(' ⚠ CONFLITO') : '';

    console.log(`  ${chalk.green(`#${pr.number}`)} — ${chalk.bold(pr.title)}${conflictLabel}`);
    console.log(chalk.dim(`    Autor: ${pr.user.login}`));
    console.log(chalk.dim(`    Branch: ${pr.head.ref} → ${pr.base.ref}`));
    console.log(chalk.dim(`    Atualizada: ${new Date(pr.updated_at).toLocaleString('pt-BR')}`));
    console.log('');
  }
}

// ─── view ─────────────────────────────────────────────────

export async function prView(prNumber) {
  const { owner, repo } = requireRepoInfo();

  console.log(chalk.blue(`\n${logSymbols.info} Buscando PR #${prNumber}...`));

  const pr = await getPullRequest(owner, repo, prNumber);
  const files = await getPullRequestFiles(owner, repo, prNumber);

  console.log(chalk.bold(`\n${logSymbols.info} PR #${pr.number}`));
  console.log('─'.repeat(50));
  console.log(`  Título:    ${chalk.bold(pr.title)}`);
  console.log(`  Autor:     ${pr.user.login}`);
  console.log(`  Estado:    ${pr.state === 'open' ? chalk.green('aberta') : chalk.red('fechada')}`);
  console.log(`  Branch:    ${chalk.green(pr.head.ref)} → ${chalk.yellow(pr.base.ref)}`);
  console.log(`  Commits:   ${pr.commits}`);
  console.log(`  Arquivos:  ${files.length} alterado(s)`);
  if (pr.mergeable === false) {
    console.log(`  ${chalk.red('⚠ Status: CONFLITO')}`);
  }
  console.log('─'.repeat(50));

  if (pr.body) {
    console.log(chalk.dim(`\n${pr.body}\n`));
  }

  if (files.length > 0) {
    console.log(chalk.bold('Arquivos alterados:'));
    for (const file of files) {
      const status = file.status === 'added' ? chalk.green('+') :
                     file.status === 'removed' ? chalk.red('-') :
                     chalk.yellow('~');
      console.log(chalk.dim(`  ${status} ${file.filename} (${file.changes} mudanças)`));
    }
    console.log('');
  }
}

// ─── diff ─────────────────────────────────────────────────

export async function prDiff(prNumber) {
  const { owner, repo } = requireRepoInfo();

  console.log(chalk.blue(`\n${logSymbols.info} Buscando diff da PR #${prNumber}...`));

  const diff = await getPullRequestDiff(owner, repo, prNumber);

  if (!diff) {
    console.log(chalk.dim('Diff vazio.'));
    return;
  }

  // Mostrar diff com syntax highlighting básico
  const lines = diff.split('\n');
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      console.log(chalk.green(line));
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      console.log(chalk.red(line));
    } else if (line.startsWith('@@')) {
      console.log(chalk.cyan(line));
    } else {
      console.log(chalk.dim(line));
    }
  }
}

// ─── review ───────────────────────────────────────────────

export async function prReview(prNumber) {
  const { owner, repo } = requireRepoInfo();

  console.log(chalk.blue(`\n${logSymbols.info} Buscando PR #${prNumber} para revisão...`));

  const pr = await getPullRequest(owner, repo, prNumber);
  const diff = await getPullRequestDiff(owner, repo, prNumber);

  if (!diff) {
    console.log(chalk.yellow(`${logSymbols.info} Diff vazio, nada para revisar.`));
    return;
  }

  console.log(chalk.blue(`${logSymbols.info} Enviando para IA analisar...`));

  const prompt = `Você é um revisor de código sênior. Analise esta Pull Request e forneça um resumo em português.

Título da PR: ${pr.title}
Descrição: ${pr.body || 'Sem descrição'}
Branch: ${pr.head.ref} → ${pr.base.ref}

Diff:
\`\`\`
${diff.substring(0, 15000)}
\`\`\`

Responda em português, de forma clara e direta:

1. Resumo: O que esta PR faz? (2-3 frases)
2. Impacto: Quais áreas do código são afetadas?
3. Riscos: Há algo que parece arriscado ou que merece atenção?
4. Testes: Que tipo de teste seria bom fazer antes de aprovar?
5. Arquivos importantes: Quais arquivos têm as mudanças mais relevantes?

NÃO diga se a PR deve ser aprovada ou não. Apenas analise.`;

  let analysis;
  try {
    analysis = await askAI(prompt);
  } catch (err) {
    console.error(chalk.red(`${logSymbols.error} Erro ao consultar a IA: ${err.message}`));
    return;
  }

  console.log(chalk.bold(`\n${logSymbols.info} Análise da IA para PR #${pr.number}:\n`));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(analysis);
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.dim('\nEsta análise é um auxílio, não uma decisão definitiva.'));
}

// ─── checkout ─────────────────────────────────────────────

export async function prCheckout(prNumber) {
  const { owner, repo } = requireRepoInfo();
  const pr = await getPullRequest(owner, repo, prNumber);

  const sourceBranch = pr.head.ref;
  const currentBranch = getCurrentBranch();

  console.log(chalk.blue(`\n${logSymbols.info} Preparando checkout da branch '${sourceBranch}'...`));

  // Verificar alterações pendentes
  if (hasUncommittedChanges()) {
    console.warn(chalk.yellow(`${logSymbols.warning} Existem alterações não commitadas.`));
    const proceed = await confirm({
      message: 'Tentar fazer checkout mesmo assim?',
      default: false,
    });
    if (!proceed) {
      console.log(chalk.yellow(`${logSymbols.info} Checkout cancelado.`));
      return;
    }
  }

  // Buscar a branch do remote
  console.log(chalk.blue(`${logSymbols.info} Buscando branch do remote...`));
  try {
    execSync(`git fetch origin ${sourceBranch}`, { encoding: 'utf-8', stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.red(`${logSymbols.error} Erro ao buscar branch: ${error.message}`));
    process.exit(1);
  }

  // Checkout
  const result = switchBranch(sourceBranch);
  if (!result.success) {
    // Tentar criar branch local a partir do remote
    console.log(chalk.blue(`${logSymbols.info} Tentando criar branch local...`));
    try {
      execSync(`git checkout -b ${sourceBranch} origin/${sourceBranch}`, { encoding: 'utf-8', stdio: 'inherit' });
      console.log(chalk.green(`${logSymbols.success} Branch '${sourceBranch}' criada e ativa.`));
    } catch (error) {
      console.error(chalk.red(`${logSymbols.error} Não foi possível fazer checkout: ${error.message}`));
      process.exit(1);
    }
  } else {
    console.log(chalk.green(`${logSymbols.success} Agora você está na branch '${sourceBranch}'.`));
  }

  console.log(chalk.dim(`\nPara voltar: jarvis branch switch ${currentBranch}`));
  console.log(chalk.dim(`Branch anterior: ${currentBranch}`));
}

// ─── approve ──────────────────────────────────────────────

export async function prApprove(prNumber) {
  const { owner, repo } = requireRepoInfo();
  const pr = await getPullRequest(owner, repo, prNumber);

  console.log(chalk.bold(`\n${logSymbols.info} Aprovar PR:`));
  console.log(`  #${pr.number} — ${pr.title}`);
  console.log(`  ${pr.head.ref} → ${pr.base.ref}`);

  const confirmed = await confirm({
    message: 'Confirmar aprovação?',
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.yellow(`${logSymbols.info} Aprovação cancelada.`));
    return;
  }

  await approvePullRequest(owner, repo, prNumber);
  console.log(chalk.green(`${logSymbols.success} PR #${pr.number} aprovada!`));
}

// ─── request-changes ──────────────────────────────────────

export async function prRequestChanges(prNumber) {
  const { owner, repo } = requireRepoInfo();
  const pr = await getPullRequest(owner, repo, prNumber);

  console.log(chalk.bold(`\n${logSymbols.info} Solicitar alterações na PR:`));
  console.log(`  #${pr.number} — ${pr.title}`);

  const comment = await input({
    message: 'Descreva as alterações necessárias:',
    validate: (value) => value.trim().length > 0 ? true : 'O comentário é obrigatório.',
  });

  console.log(chalk.dim(`\nComentário: ${comment}`));

  const confirmed = await confirm({
    message: 'Enviar solicitação de alterações?',
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.yellow(`${logSymbols.info} Cancelado.`));
    return;
  }

  await requestChanges(owner, repo, prNumber, comment);
  console.log(chalk.green(`${logSymbols.success} Alterações solicitadas na PR #${pr.number}.`));
}

// ─── comment ──────────────────────────────────────────────

export async function prComment(prNumber) {
  const { owner, repo } = requireRepoInfo();
  const pr = await getPullRequest(owner, repo, prNumber);

  console.log(chalk.bold(`\n${logSymbols.info} Comentar na PR #${pr.number} — ${pr.title}`));

  const comment = await input({
    message: 'Digite o comentário:',
    validate: (value) => value.trim().length > 0 ? true : 'O comentário é obrigatório.',
  });

  console.log(chalk.dim(`\nPrévia: ${comment}`));

  const confirmed = await confirm({
    message: 'Enviar comentário?',
    default: true,
  });

  if (!confirmed) {
    console.log(chalk.yellow(`${logSymbols.info} Cancelado.`));
    return;
  }

  await commentOnPR(owner, repo, prNumber, comment);
  console.log(chalk.green(`${logSymbols.success} Comentário adicionado.`));
}

// ─── merge ────────────────────────────────────────────────

export async function prMerge(prNumber) {
  const protectedBranch = getProtectedBranch();
  const { owner, repo } = requireRepoInfo();
  const pr = await getPullRequest(owner, repo, prNumber);

  console.log(chalk.bold(`\n${logSymbols.info} Merge da PR:`));
  console.log(`  #${pr.number} — ${pr.title}`);
  console.log(`  Origem:  ${chalk.green(pr.head.ref)}`);
  console.log(`  Destino: ${chalk.yellow(pr.base.ref)}`);

  if (pr.base.ref === protectedBranch) {
    console.warn(chalk.yellow(`\n${logSymbols.warning} Atenção: merge na branch protegida '${protectedBranch}'!`));
  }

  if (pr.mergeable === false) {
    console.error(chalk.red(`\n${logSymbols.error} Esta PR tem conflitos. Resolva-os antes do merge.`));
    return;
  }

  const confirmed = await confirm({
    message: pr.base.ref === protectedBranch
      ? chalk.red('Confirmar merge na branch protegida?')
      : 'Confirmar merge?',
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.yellow(`${logSymbols.info} Merge cancelado.`));
    return;
  }

  console.log(chalk.blue(`${logSymbols.info} Executando merge...`));
  const result = await mergePullRequest(owner, repo, prNumber);
  console.log(chalk.green(`${logSymbols.success} PR #${pr.number} mergeada com sucesso!`));
  if (result.message) {
    console.log(chalk.dim(result.message));
  }
}

// ─── close ────────────────────────────────────────────────

export async function prClose(prNumber) {
  const { owner, repo } = requireRepoInfo();
  const pr = await getPullRequest(owner, repo, prNumber);

  console.log(chalk.bold(`\n${logSymbols.info} Fechar PR:`));
  console.log(`  #${pr.number} — ${pr.title}`);

  const confirmed = await confirm({
    message: chalk.red('Tem certeza que deseja fechar esta PR sem merge?'),
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.yellow(`${logSymbols.info} Cancelado.`));
    return;
  }

  await closePullRequest(owner, repo, prNumber);
  console.log(chalk.yellow(`${logSymbols.info} PR #${pr.number} fechada sem merge.`));
}