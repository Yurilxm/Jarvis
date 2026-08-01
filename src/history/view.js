import { select } from '@inquirer/prompts';
import { execFileSync } from 'node:child_process';
import { readHistory, findHistoryEntry } from './store.js';
import { isGitRepo } from '../git/status.js';
import {
  printBanner,
  printBox,
  info,
  warn,
  dim,
  blank,
  section,
  chalk,
  muted,
  accent,
} from '../ui.js';

/**
 * @param {string} iso
 */
function formatWhen(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * @param {object} entry
 */
function shortHash(entry) {
  return entry.hash ? entry.hash.slice(0, 7) : '-------';
}

/**
 * Lista visual do histórico Jarvis.
 * @param {{ limit?: number, pushedOnly?: boolean }} [options]
 */
export async function runHistoryView(options = {}) {
  printBanner();

  const limit = options.limit ?? 30;
  const pushedOnly = Boolean(options.pushedOnly);
  const entries = readHistory({ limit, pushedOnly });

  if (entries.length === 0) {
    printBox(
      `${muted('Nenhum evento ainda.')}\n` +
      `${muted('O histórico é preenchido quando você usa')} ${chalk.green('jarvis commit')}.`,
      { title: 'histórico' }
    );
    return;
  }

  const summary = entries
    .map((e, i) => {
      const n = String(i + 1).padStart(2, '0');
      const flag = e.pushed ? chalk.green('▲ push') : muted('· local');
      const hash = chalk.cyan(shortHash(e));
      const branch = chalk.yellow(e.branch || '?');
      const when = muted(formatWhen(e.at));
      const title = e.title || '(sem título)';
      return `${accent(n)}  ${hash}  ${flag}  ${branch}  ${when}\n    ${title}`;
    })
    .join('\n\n');

  printBox(summary, { title: `histórico · ${entries.length} evento(s)` });

  const choice = await select({
    message: 'Ver detalhes?',
    choices: [
      ...entries.slice(0, 15).map((e, i) => ({
        name: `${shortHash(e)} — ${e.title || '(sem título)'}`,
        value: e.id,
      })),
      { name: 'Só sair', value: 'exit' },
    ],
  });

  if (choice === 'exit') {
    return;
  }

  const entry = findHistoryEntry(choice) || entries.find((e) => e.id === choice);
  if (!entry) {
    warn('Evento não encontrado.');
    return;
  }

  showEntryDetail(entry);
}

/**
 * @param {object} entry
 */
export function showEntryDetail(entry) {
  const pushLine = entry.pushed
    ? `${chalk.green('sim')}${entry.pushedAt ? muted(` · ${formatWhen(entry.pushedAt)}`) : ''}`
    : chalk.yellow('não');

  const files = (entry.files || []).length > 0
    ? entry.files.map((f) => `  · ${f}`).join('\n')
    : muted('  (não registrado)');

  const body = entry.body
    ? `\n${muted('Corpo')}\n${entry.body}`
    : '';

  printBox(
    `${chalk.bold('Quando')}   ${formatWhen(entry.at)}\n` +
    `${chalk.bold('Branch')}   ${chalk.yellow(entry.branch || '?')}\n` +
    `${chalk.bold('Hash')}     ${chalk.cyan(entry.hash || '—')}\n` +
    `${chalk.bold('Push')}     ${pushLine}\n` +
    `${chalk.bold('Repo')}     ${entry.repo || entry.cwd || '—'}\n` +
    `${chalk.bold('Arquivos')} ${entry.fileCount ?? 0}\n\n` +
    `${chalk.bold('Título')}\n${entry.title || '—'}` +
    body +
    `\n\n${chalk.bold('Arquivos')}\n${files}`,
    { title: 'detalhe', borderColor: 'green' }
  );
}

/**
 * Atalho: mostra os últimos commits do git com marcação se estão no histórico Jarvis.
 * (opcional no menu — usado se quiser misturar views)
 */
export function peekGitLog(limit = 10) {
  if (!isGitRepo()) {
    info('Não é um repositório Git.');
    return;
  }

  try {
    const out = execFileSync(
      'git',
      ['log', `-${limit}`, '--pretty=format:%h|%ad|%s', '--date=short'],
      { encoding: 'utf-8' }
    ).trim();

    if (!out) {
      dim('Sem commits no Git.');
      return;
    }

    const jarvisHashes = readHistory({ limit: 500 })
      .map((e) => e.hash)
      .filter(Boolean);

    section('Git log recente');
    for (const line of out.split('\n')) {
      const [hash, date, ...rest] = line.split('|');
      const subject = rest.join('|');
      const fromJarvis = jarvisHashes.some(
        (h) => h === hash || h.startsWith(hash) || hash.startsWith(h.slice(0, 7))
      );
      const mark = fromJarvis ? chalk.green('jarvis') : muted('git');
      console.log(`  ${chalk.cyan(hash)}  ${muted(date)}  ${mark}  ${subject}`);
    }
    blank();
  } catch (err) {
    warn(`Não foi possível ler o git log: ${err.message}`);
  }
}
