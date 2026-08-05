import { isGitRepo } from '../git/status.js';
import { prList, prView, prDiff, prReview, prCheckout, prApprove, prRequestChanges, prComment, prMerge, prClose } from './flow.js';
import { error, dim } from '../ui.js';

export async function handlePrCommand(sub, arg) {
  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    process.exit(1);
  }

  if (!sub || sub === 'list') {
    await prList();
  } else if (sub === 'view') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prView(parseInt(arg));
  } else if (sub === 'diff') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prDiff(parseInt(arg));
  } else if (sub === 'review') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prReview(parseInt(arg));
  } else if (sub === 'checkout') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prCheckout(parseInt(arg));
  } else if (sub === 'approve') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prApprove(parseInt(arg));
  } else if (sub === 'request-changes') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prRequestChanges(parseInt(arg));
  } else if (sub === 'comment') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prComment(parseInt(arg));
  } else if (sub === 'merge') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prMerge(parseInt(arg));
  } else if (sub === 'close') {
    if (!arg) { error('Número da PR é obrigatório.'); process.exit(1); }
    await prClose(parseInt(arg));
  } else {
    error(`Subcomando desconhecido: ${sub}`);
    dim('Use: list, view <n>, diff <n>, review <n>, checkout <n>, approve <n>, request-changes <n>, comment <n>, merge <n>, close <n>');
    process.exit(1);
  }
}