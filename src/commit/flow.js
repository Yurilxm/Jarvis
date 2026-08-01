import { isGitRepo, getGitStatus } from '../git/status.js';
import { getSafeDiff, stageFiles } from '../git/diff.js';
import { sanitizeDiff, filterSensitiveFiles } from './sanitize.js';
import { buildCommitPrompt } from './promptBuilder.js';
import { askAI } from '../ai/client.js';
import { getCurrentBranch, hasUncommittedChanges, switchBranch, getPushRemote } from '../git/branch.js';
import { PROTECTED_BRANCH, DEVELOPMENT_BRANCH } from '../config/branches.js';
import { appendHistory } from '../history/store.js';
import { loadProfile } from '../config/profile.js';
import { buildSignature } from './signature.js';
import { confirm, input, select } from '@inquirer/prompts';
import { execFileSync } from 'node:child_process';
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
  showLoading,
  chalk,
  accent,
} from '../ui.js';

/**
 * Fluxo completo do assistente de commit.
 */
export async function runCommitFlow() {
  await showLoading('Iniciando commit assistant', {
    steps: ['Lendo git', 'Preparando diff', 'Conectando IA'],
    durationMs: 900,
  });
  printBanner();

  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    dim('Execute o Jarvis dentro de um projeto com git, ou rode: jarvis init');
    process.exit(1);
  }

  const branch = getCurrentBranch();

  if (branch === PROTECTED_BRANCH) {
    warn(`Você está na branch '${PROTECTED_BRANCH}' (protegida).`);
    dim('Commits diretos na main não são recomendados.');

    const choice = await select({
      message: 'O que deseja fazer?',
      choices: [
        { name: `Trocar para '${DEVELOPMENT_BRANCH}'`, value: 'switch' },
        { name: `Continuar na '${PROTECTED_BRANCH}'`, value: 'continue' },
        { name: 'Cancelar', value: 'cancel' },
      ],
    });

    if (choice === 'cancel') {
      info('Commit cancelado.');
      process.exit(0);
    }

    if (choice === 'switch') {
      if (hasUncommittedChanges()) {
        warn('Existem alterações não commitadas.');

        const forceChoice = await confirm({
          message: 'Tentar trocar mesmo assim? (alterações podem ser perdidas)',
          default: false,
        });

        if (!forceChoice) {
          info('Faça commit ou stash das alterações e tente novamente.');
          process.exit(0);
        }
      }

      const result = switchBranch(DEVELOPMENT_BRANCH);
      if (!result.success) {
        error(`Não foi possível trocar para '${DEVELOPMENT_BRANCH}':`);
        dim(result.message);
        process.exit(1);
      }

      success(`Agora você está na branch '${DEVELOPMENT_BRANCH}'.`);
      dim('Execute jarvis commit novamente para commitar suas alterações.');
      process.exit(0);
    }

    if (choice === 'continue') {
      const confirmed = await confirm({
        message: chalk.red(`Tem certeza que deseja commitar diretamente na '${PROTECTED_BRANCH}'?`),
        default: false,
      });

      if (!confirmed) {
        info('Commit cancelado.');
        process.exit(0);
      }

      warn(`Prosseguindo com commit na '${PROTECTED_BRANCH}'...`);
    }
  }

  const status = getGitStatus();
  const allChangedFiles = [
    ...status.staged,
    ...status.modified,
    ...status.deleted,
    ...status.untracked,
  ];

  const uniqueFiles = [...new Set(allChangedFiles)];

  if (uniqueFiles.length === 0) {
    info('Nenhuma alteração detectada. Não há nada para commit.');
    process.exit(0);
  }

  const { safe, blocked, ignoreSource } = filterSensitiveFiles(uniqueFiles);

  if (blocked.length > 0) {
    warn(`Arquivos ignorados (${ignoreSource}):`);
    printFileList(blocked, { bullet: '!', color: 'yellow' });
    dim('  Configure mais regras em .jarvisignore');
  }

  if (safe.length === 0) {
    info('Todos os arquivos alterados estão na lista de ignore. Nada a analisar.');
    process.exit(0);
  }

  section(`Branch ${accent(branch)}  ·  ${safe.length} arquivo(s)`);
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
    info('Nenhum conteúdo relevante no diff para analisar.');
    process.exit(0);
  }

  const prompt = buildCommitPrompt(sanitized);

  let message;
  const gen = spinner('Gerando mensagem de commit com IA...');
  gen.start();
  try {
    message = await askAI(prompt);
    gen.succeed('Mensagem gerada.');
  } catch (err) {
    gen.fail(`Erro ao comunicar com a IA: ${err.message}`);
    process.exit(1);
  }

  while (true) {
    printBox(message, { title: 'mensagem sugerida', borderColor: 'green' });

    const action = await input({
      message: 'O que deseja fazer? (a)provar / (e)ditar / (g)erar novamente / (c)ancelar',
      validate: (value) => {
        const v = value.toLowerCase();
        if (['a', 'e', 'g', 'c'].includes(v)) return true;
        return 'Digite a, e, g ou c';
      }
    });

    const choice = action.toLowerCase();

    if (choice === 'c') {
      info('Commit cancelado.');
      process.exit(0);
    }

    if (choice === 'a') {
      break;
    }

    if (choice === 'e') {
      message = await input({
        message: 'Edite a mensagem:',
        default: message,
      });
      break;
    }

    if (choice === 'g') {
      const regen = spinner('Gerando nova mensagem...');
      regen.start();
      try {
        message = await askAI(prompt);
        regen.succeed('Nova mensagem gerada.');
      } catch (err) {
        regen.fail(`Erro ao comunicar com a IA: ${err.message}`);
        process.exit(1);
      }
    }
  }

  // Adicionar assinatura
  const profile = loadProfile();
  const signature = buildSignature(profile);
  if (signature) {
    message = message + '\n\n' + signature;
  }

  info(`Executando git add em ${safe.length} arquivo(s) (respeitando ignore)...`);
  try {
    stageFiles(safe);
  } catch (err) {
    error(`Erro ao executar git add: ${err.message}`);
    process.exit(1);
  }

  info('Executando git commit...');

  const bodySeparator = '---BODY---';
  let title = message;
  let body = '';

  if (message.includes(bodySeparator)) {
    const parts = message.split(bodySeparator);
    title = parts[0].trim();
    body = parts.slice(1).join(bodySeparator).trim();
  }

  try {
    if (body) {
      execFileSync('git', ['commit', '-m', title, '-m', body], {
        stdio: 'inherit',
      });
    } else {
      execFileSync('git', ['commit', '-m', title], {
        stdio: 'inherit',
      });
    }
  } catch (err) {
    error(`Erro ao executar git commit: ${err.message}`);
    dim('Os arquivos foram adicionados (git add) mas o commit falhou.');
    process.exit(1);
  }

  success('Commit realizado com sucesso!');

  let commitHash = null;
  try {
    commitHash = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
  } catch {
    // ignore
  }

  const currentBranchAfterCommit = getCurrentBranch();

  const historyEntry = {
    action: 'commit',
    branch: currentBranchAfterCommit,
    hash: commitHash,
    title,
    body,
    files: safe,
    fileCount: safe.length,
    pushed: false,
    pushedAt: null,
  };

  const shouldPush = await confirm({
    message: `Deseja fazer push da branch '${currentBranchAfterCommit}'?`,
    default: false,
  });

  if (shouldPush) {
    info('Executando git push...');
    try {
      const pushRemote = getPushRemote(currentBranchAfterCommit);
      if (pushRemote) {
        execFileSync('git', ['push'], { stdio: 'inherit' });
      } else {
        execFileSync('git', ['push', '--set-upstream', 'origin', currentBranchAfterCommit], {
          stdio: 'inherit',
        });
      }
      success('Push realizado com sucesso!');
      historyEntry.pushed = true;
      historyEntry.pushedAt = new Date().toISOString();
      appendHistory(historyEntry);

      if (currentBranchAfterCommit === DEVELOPMENT_BRANCH) {
        blank();
        const mergeChoice = await select({
          message: 'Deseja iniciar o merge dev → main?',
          choices: [
            { name: 'Iniciar merge agora', value: 'now' },
            { name: 'Testar depois', value: 'later' },
            { name: 'Não', value: 'no' },
          ],
        });

        if (mergeChoice === 'now') {
          const { runMergeFlow } = await import('./merge.js');
          await runMergeFlow();
        } else if (mergeChoice === 'later') {
          dim('Merge adiado. Execute jarvis merge quando estiver pronto.');
        }
      }
    } catch (err) {
      appendHistory(historyEntry);
      error(`Erro ao executar git push: ${err.message}`);
      dim('O commit foi feito localmente, mas o push falhou.');
      process.exit(1);
    }
  } else {
    appendHistory(historyEntry);
    dim('Push não realizado. Lembre-se de fazer push manualmente.');
  }
}