import { isGitRepo, getGitStatus } from '../git/status.js';
import { getSafeDiff } from '../git/diff.js';
import { sanitizeDiff, filterSensitiveFiles } from '../commit/sanitize.js';
import { buildReviewPrompt } from './promptBuilder.js';
import { askAI } from '../ai/client.js';
import {
  printBanner,
  printBox,
  printFileList,
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
} from '../ui.js';

const MAX_DIFF_SIZE = 15000;

/**
 * Fluxo de revisão de código.
 * @param {string} scope - 'all' ou 'staged'
 */
export async function runReviewFlow(scope = 'all') {
  printBanner();

  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    dim('Execute o Jarvis dentro de um projeto com git.');
    process.exit(1);
  }

  const status = getGitStatus();
  const files = scope === 'staged'
    ? [...status.staged]
    : [...status.staged, ...status.modified, ...status.deleted, ...status.untracked];

  const uniqueFiles = [...new Set(files)];

  if (uniqueFiles.length === 0) {
    info('Nenhuma alteração detectada para revisar.');
    process.exit(0);
  }

  const { safe, blocked, ignoreSource } = filterSensitiveFiles(uniqueFiles);

  if (blocked.length > 0) {
    warn(`Arquivos ignorados (${ignoreSource}):`);
    printFileList(blocked, { bullet: '!', color: 'yellow' });
  }

  if (safe.length === 0) {
    info('Todos os arquivos alterados estão na lista de ignore.');
    process.exit(0);
  }

  section(`Revisando ${safe.length} arquivo(s)`);
  printFileList(safe);

  const safeSet = new Set(safe);
  const safeUntracked = status.untracked.filter((f) => safeSet.has(f));
  const safeTracked = safe.filter((f) => !safeUntracked.includes(f));

  const rawDiff = getSafeDiff({ tracked: safeTracked, untracked: safeUntracked });
  const { sanitized, warnings } = sanitizeDiff(rawDiff);

  if (warnings.length > 0) {
    warn('Conteúdo sensível removido do diff antes do envio à IA.');
  }

  if (!sanitized.trim()) {
    info('Nenhum conteúdo relevante no diff para revisar.');
    process.exit(0);
  }

  // Verificar tamanho do diff
  if (sanitized.length > MAX_DIFF_SIZE) {
    warn(`O diff tem ${sanitized.length} caracteres (limite: ${MAX_DIFF_SIZE}).`);
    dim('Apenas os primeiros arquivos serão analisados para evitar estouro de tokens.');
    blank();
  }

  const diffToReview = sanitized.substring(0, MAX_DIFF_SIZE);
  const prompt = buildReviewPrompt(diffToReview);

  const spin = spinner('Analisando alterações com IA...');
  spin.start();

  try {
    const review = await askAI(prompt);
    spin.succeed('Revisão concluída!');

    blank();
    printBox(review, { title: 'revisão de código', borderColor: 'cyan' });
    blank();

    dim('Esta é uma análise somente-leitura. Nenhuma alteração foi feita no código.');
    dim('Use jarvis commit para commitar as alterações quando estiver pronto.');
    blank();
  } catch (err) {
    spin.fail('Erro ao comunicar com a IA');
    error(err.message);
    process.exit(1);
  }
}