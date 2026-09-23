import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { input, select } from '@inquirer/prompts';
import { getIssue } from '../jira/client.js';
import { getJiraConfig } from '../config/jira.js';
import { readHistory } from '../history/store.js';
import { sanitizeDiff } from '../commit/sanitize.js';
import { buildReportPrompt } from './promptBuilder.js';
import { askAI } from '../ai/client.js';
import { ensureGitignoreEntry } from '../utils/gitignore.js';
import { parseDuration, formatDuration } from './duration.js';
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
  muted,
} from '../ui.js';

const MAX_DIFF_PER_COMMIT = 4000;
const MAX_TOTAL_CHARS = 40000;

function requireJiraConfig() {
  getJiraConfig();
}

function getCommitDiff(hash) {
  if (!hash) return '';
  try {
    const out = execFileSync(
      'git',
      ['show', hash, '--no-color', '--unified=2', '--format='],
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
    );
    return out;
  } catch {
    return '';
  }
}

/**
 * Fluxo: jarvis report <issue> [--since 7d]
 * Gera um relatório de desenvolvimento cruzando a issue do Jira
 * (opcional) com os commits registrados no histórico.
 *
 * @param {string} issueKey - chave da issue (ex: SDG-71) ou null
 * @param {{ since?: string }} [opts]
 */
export async function runReport(issueKey, opts = {}) {
  printBanner();

  const sinceMs = opts.since ? parseDuration(opts.since) : null;
  if (opts.since && !sinceMs) {
    error(`Formato de --since inválido: "${opts.since}". Use: 7d, 24h, 2w, 1m.`);
    process.exitCode = 1;
    return;
  }

  // 1. Buscar issue (se informada)
  let issue = null;
  const key = issueKey ? String(issueKey).trim().toUpperCase() : null;

  if (key) {
    requireJiraConfig();
    const spinIssue = spinner(`Buscando ${key} no Jira...`);
    spinIssue.start();
    try {
      issue = await getIssue(key);
      spinIssue.succeed(`${key}: ${issue.fields.summary}`);
    } catch (err) {
      spinIssue.fail('Erro ao buscar issue no Jira');
      error(err.message);
      process.exitCode = 1;
      return;
    }
  }

  // 2. Filtrar o histórico
  let matched = readHistory({ limit: 1000, jiraIssue: key || null });

  // Aplicar filtro de tempo se --since
  if (sinceMs) {
    const cutoff = Date.now() - sinceMs;
    matched = matched.filter((c) => {
      const t = c.at ? new Date(c.at).getTime() : 0;
      return t >= cutoff;
    });
  }

  if (matched.length === 0) {
    if (key && sinceMs) {
      warn(`Nenhum commit de ${key} nos últimos ${formatDuration(sinceMs)}.`);
    } else if (key) {
      warn(`Nenhum commit registrado para ${key} no histórico do Jarvis.`);
      dim('O histórico é preenchido quando você usa jarvis commit em branches como feature/' + key + '-...');
    } else if (sinceMs) {
      warn(`Nenhum commit registrado nos últimos ${formatDuration(sinceMs)}.`);
    } else {
      warn('Nenhum commit encontrado.');
    }
    blank();
    return;
  }

  const ordered = [...matched].reverse();

  const header = key
    ? `${ordered.length} commit(s) para ${key}${sinceMs ? ` nos últimos ${formatDuration(sinceMs)}` : ''}`
    : `${ordered.length} commit(s)${sinceMs ? ` nos últimos ${formatDuration(sinceMs)}` : ''}`;
  section(header);

  for (const c of ordered) {
    const hash = c.hash ? c.hash.slice(0, 7) : '?';
    console.log(`  ${chalk.cyan(hash)}  ${c.title || '(sem título)'}`);
  }
  blank();

  // 3. Coletar diffs
  const spinDiffs = spinner('Coletando diffs dos commits...');
  spinDiffs.start();

  const commitsWithDiffs = [];
  let totalChars = 0;
  let truncatedCount = 0;

  for (const c of ordered) {
    const rawDiff = getCommitDiff(c.hash);
    const sanitized = sanitizeDiff(rawDiff).sanitized;

    let diffToUse = sanitized;
    if (diffToUse.length > MAX_DIFF_PER_COMMIT) {
      diffToUse = diffToUse.slice(0, MAX_DIFF_PER_COMMIT) + '\n... (truncado)';
    }

    if (totalChars + diffToUse.length > MAX_TOTAL_CHARS) {
      commitsWithDiffs.push({ ...c, diff: '(diff omitido — limite de contexto atingido)' });
      truncatedCount++;
      continue;
    }

    commitsWithDiffs.push({ ...c, diff: diffToUse });
    totalChars += diffToUse.length;
  }

  spinDiffs.succeed(`${commitsWithDiffs.length} diff(s) coletado(s)`);
  if (truncatedCount > 0) {
    dim(`  ${truncatedCount} commit(s) tiveram o diff omitido por limite de contexto.`);
  }

  // 4. Prompt + IA
  const prompt = buildReportPrompt(issue, commitsWithDiffs);

  const spinAI = spinner('Gerando relatório com IA...');
  spinAI.start();

  let report;
  try {
    report = await askAI(prompt);
    spinAI.succeed('Relatório gerado.');
  } catch (err) {
    spinAI.fail('Erro ao comunicar com a IA');
    error(err.message);
    process.exitCode = 1;
    return;
  }

  blank();
  const title = key ? `relatório · ${key}` : `relatório${sinceMs ? ` · últimos ${formatDuration(sinceMs)}` : ''}`;
  printBox(report, { title, borderColor: 'cyan' });
  blank();

  // 5. Salvar
  const saveChoice = await select({
    message: 'O que deseja fazer com o relatório?',
    choices: [
      { name: 'Salvar em arquivo .md', value: 'save' },
      { name: 'Não salvar (já está no terminal)', value: 'noop' },
    ],
    default: 'save',
  });

  if (saveChoice === 'noop') {
    dim('Relatório não foi salvo.');
    return;
  }

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    try {
      fs.mkdirSync(reportsDir, { recursive: true });
    } catch {
      // cai no cwd mesmo
    }
  }

  const suffix = key || (sinceMs ? `since-${opts.since}` : 'geral');
  const stamp = new Date().toISOString().slice(0, 10);
  const defaultName = path.join('reports', `${suffix}-${stamp}.md`);

  const fileName = await input({
    message: 'Caminho do arquivo:',
    default: defaultName,
    validate: (v) => (v.trim().length > 0 ? true : 'Informe um caminho.'),
  });

  const filePath = path.resolve(process.cwd(), fileName.trim());

  try {
    fs.writeFileSync(filePath, report, 'utf-8');
    success(`Relatório salvo em ${filePath}`);
  } catch (err) {
    error(`Erro ao salvar: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const gi = ensureGitignoreEntry('reports/');
    if (gi.added) {
      dim(`  ${gi.created ? 'Criado' : 'Atualizado'} .gitignore (adicionado: reports/).`);
    }
  } catch {
    // silencioso
  }
}