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

/**
 * Extrai apenas o diff de um commit (sem mensagem/metadados).
 * @param {string} hash
 * @returns {string}
 */
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
 * Fluxo: jarvis report <issue>
 * Gera um relatório de desenvolvimento cruzando a issue do Jira
 * com os commits registrados no histórico para aquela chave.
 *
 * @param {string} issueKey - chave da issue (ex: SDG-71)
 */
export async function runReport(issueKey) {
  printBanner();
  requireJiraConfig();

  if (!issueKey) {
    error('Informe a chave da issue. Ex: jarvis report SDG-71');
    process.exitCode = 1;
    return;
  }

  const key = String(issueKey).trim().toUpperCase();

  // 1. Buscar a issue no Jira
  const spinIssue = spinner(`Buscando ${key} no Jira...`);
  spinIssue.start();
  let issue;
  try {
    issue = await getIssue(key);
    spinIssue.succeed(`${key}: ${issue.fields.summary}`);
  } catch (err) {
    spinIssue.fail('Erro ao buscar issue no Jira');
    error(err.message);
    process.exitCode = 1;
    return;
  }

  // 2. Filtrar o histórico
  const matched = readHistory({ limit: 1000, jiraIssue: key });

  if (matched.length === 0) {
    warn(`Nenhum commit registrado para ${key} no histórico do Jarvis.`);
    dim('O histórico é preenchido quando você usa jarvis commit em branches como feature/' + key + '-...');
    blank();
    return;
  }

  // Ordem cronológica (mais antigo → mais recente)
  const ordered = [...matched].reverse();

  section(`${ordered.length} commit(s) encontrado(s) para ${key}`);
  for (const c of ordered) {
    const hash = c.hash ? c.hash.slice(0, 7) : '?';
    console.log(`  ${chalk.cyan(hash)}  ${c.title || '(sem título)'}`);
  }
  blank();

  // 3. Coletar diffs (respeitando limite total)
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

  // 4. Montar prompt e chamar a IA uma única vez
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

  // 5. Mostrar o resultado
  blank();
  printBox(report, { title: `relatório · ${key}`, borderColor: 'cyan' });
  blank();

  // 6. Oferecer salvar
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
      // se não conseguir criar, salva no cwd mesmo
    }
  }

  const defaultName = path.join('reports', `${key}-relatorio.md`);
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

  // Garante reports/ no .gitignore
  try {
    const gi = ensureGitignoreEntry('reports/');
    if (gi.added) {
      dim(`  ${gi.created ? 'Criado' : 'Atualizado'} .gitignore (adicionado: reports/).`);
    }
  } catch {
    // silencioso
  }
}