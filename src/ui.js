import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import logSymbols from 'log-symbols';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const accent = chalk.cyan;
const muted = chalk.dim;
const label = chalk.bold;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export function printBanner() {
  const art = [
    '     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗',
    '     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝',
    '     ██║███████║██████╔╝██║   ██║██║███████╗',
    '██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║',
    '╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║',
    ' ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝',
  ].join('\n');

  const version = getVersion();

  console.log('');
  console.log(chalk.green(art));
  console.log(muted(`  Assistente pessoal de automação  ·  v${version}`));
  console.log('');
}

export function info(message) {
  console.log(chalk.cyan(`${logSymbols.info} ${message}`));
}

export function success(message) {
  console.log(chalk.green(`${logSymbols.success} ${message}`));
}

export function warn(message) {
  console.warn(chalk.yellow(`${logSymbols.warning} ${message}`));
}

export function error(message) {
  console.error(chalk.red(`${logSymbols.error} ${message}`));
}

export function dim(message) {
  console.log(muted(message));
}

export function blank() {
  console.log('');
}

export function section(title) {
  console.log('');
  console.log(label(accent(`▸ ${title}`)));
}

export function printBox(content, { title, borderColor = 'cyan' } = {}) {
  console.log(
    boxen(content, {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor,
      title: title ? accent(title) : undefined,
      titleAlignment: 'left',
    })
  );
}

export function printFileList(files, { bullet = '·', color = 'dim' } = {}) {
  const paint = chalk[color] || muted;
  for (const file of files) {
    console.log(paint(`   ${bullet} ${file}`));
  }
}

export function spinner(text) {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Barra de carregamento limpa no terminal.
 * @param {string} label
 * @param {{ steps?: string[], durationMs?: number }} [options]
 */
export async function showLoading(label = 'Carregando', { steps, durationMs = 900 } = {}) {
  const stages = steps ?? [
    'Preparando ambiente',
    'Lendo configuração',
    'Quase pronto',
  ];

  const barWidth = 24;
  const total = stages.length;

  console.log('');
  console.log(accent(`  ${label}`));

  for (let i = 0; i < total; i++) {
    const filled = Math.round(((i + 1) / total) * barWidth);
    const empty = barWidth - filled;
    const bar = chalk.green('█'.repeat(filled)) + muted('░'.repeat(empty));
    const pct = Math.round(((i + 1) / total) * 100);
    const stage = muted(stages[i]);

    process.stdout.write(`\r  ${bar}  ${chalk.green(`${pct}%`)}  ${stage}`.padEnd(80));
    await sleep(Math.max(120, Math.floor(durationMs / total)));
  }

  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  success('Pronto');
  blank();
}

export { chalk, accent, muted, label, logSymbols };
