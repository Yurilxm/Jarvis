import { isGitRepo, getGitStatus } from '../git/status.js';
import { getSafeDiff, stageFiles } from '../git/diff.js';
import { sanitizeDiff, filterSensitiveFiles } from './sanitize.js';
import { buildCommitPrompt } from './promptBuilder.js';
import { askAI } from '../ai/client.js';
import { getCurrentBranch, hasUncommittedChanges, switchBranch, createBranch, getPushRemote } from '../git/branch.js';
import { getProtectedBranch, getDevelopmentBranch } from '../config/branches.js';
import { appendHistory } from '../history/store.js';
import { loadProfile } from '../config/profile.js';
import { buildSignature } from './signature.js';
import { confirm, input, select, checkbox } from '@inquirer/prompts';
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
import { filterInternalPaths, shouldSuggestJarvisRelease } from './helpers.js';

/**
 * Fluxo completo do assistente de commit.
 */
export async function runCommitFlow() {
  const protectedBranch = getProtectedBranch();
  const developmentBranch = getDevelopmentBranch();
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

  if (branch === protectedBranch) {
    warn(`Você está na branch '${protectedBranch}' (protegida).`);
    dim('Commits diretos na main não são recomendados.');

    const choice = await select({
      message: 'O que deseja fazer?',
      choices: [
        { name: `Trocar para '${developmentBranch}'`, value: 'switch' },
        { name: `Continuar na '${protectedBranch}'`, value: 'continue' },
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

      let result = switchBranch(developmentBranch);
      if (!result.success) {
        warn(`Branch '${developmentBranch}' não existe neste projeto.`);

        const createDev = await confirm({
          message: `Deseja criar a branch '${developmentBranch}'?`,
          default: true,
        });

        if (createDev) {
          const createResult = createBranch(developmentBranch);
          if (!createResult.success) {
            error(createResult.message);
            process.exit(1);
          }
          success(`Branch '${developmentBranch}' criada.`);

          result = switchBranch(developmentBranch);
          if (!result.success) {
            error(`Não foi possível trocar para '${developmentBranch}': ${result.message}`);
            process.exit(1);
          }
        } else {
          info('Commit cancelado. Crie a branch dev com: jarvis branch create dev');
          process.exit(0);
        }
      }

      success(`Agora você está na branch '${developmentBranch}'.`);
      dim('Execute jarvis commit novamente para commitar suas alterações.');
      process.exit(0);
    }

    if (choice === 'continue') {
      const confirmed = await confirm({
        message: chalk.red(`Tem certeza que deseja commitar diretamente na '${protectedBranch}'?`),
        default: false,
      });

      if (!confirmed) {
        info('Commit cancelado.');
        process.exit(0);
      }

      warn(`Prosseguindo com commit na '${protectedBranch}'...`);
    }
  }

  const status = getGitStatus();
  const allChangedFiles = filterInternalPaths ([
    ...status.staged,
    ...status.modified,
    ...status.deleted,
    ...status.untracked,
  ]);

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

  // Seleção de arquivos
  const stageMode = await select({
    message: 'Como deseja commitar os arquivos?',
    choices: [
      { name: `Todos os ${safe.length} arquivo(s)`, value: 'all' },
      { name: 'Selecionar arquivos manualmente', value: 'manual' },
    ],
  });

  let selectedSafe = safe;

  if (stageMode === 'manual') {
    selectedSafe = await checkbox({
      message: 'Selecione os arquivos para commitar:',
      choices: safe.map((file) => ({ name: file, value: file })),
      validate: (values) => values.length > 0 ? true : 'Selecione pelo menos um arquivo.',
    });

    if (selectedSafe.length === 0) {
      info('Nenhum arquivo selecionado.');
      process.exit(0);
    }
  }

  section(`Branch ${accent(branch)}  ·  ${selectedSafe.length} arquivo(s)`);
  printFileList(selectedSafe);

  const safeSet = new Set(selectedSafe);
  const safeUntracked = status.untracked.filter((f) => safeSet.has(f));
  const safeTracked = selectedSafe.filter((f) => !safeUntracked.includes(f));

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

  info(`Executando git add em ${selectedSafe.length} arquivo(s) (respeitando ignore)...`);
  try {
    stageFiles(selectedSafe);
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
    files: selectedSafe,
    fileCount: selectedSafe.length,
    pushed: false,
    pushedAt: null,
  };

  const shouldPush = await confirm({
    message: `Deseja fazer push da branch '${currentBranchAfterCommit}'?`,
    default: false,
  });

  let releaseDone = false;

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

      // Só sugere release automático quando estamos no próprio repositório do Jarvis
      const remoteUrl = (() => {
        try {
          return execFileSync('git', ['config', '--get', 'remote.origin.url'], {
            encoding: 'utf-8',
          }).trim();
        } catch {
          return '';
        }
      })();

      const commitType = title.split(':')[0].trim();

      if (shouldSuggestJarvisRelease(remoteUrl, commitType)) {
        blank();
        const isFeat = commitType === 'feat';
        const suggestedBump = isFeat ? 'minor' : 'patch';
        const bumpLabel = isFeat ? 'nova funcionalidade (minor)' : 'correção de bug (patch)';

        const doRelease = await confirm({
          message: `Este commit parece ser uma ${bumpLabel}. Deseja criar uma release ${suggestedBump}?`,
          default: false,
        });

        if (doRelease) {
          const { runReleaseFromCommit } = await import('./release.js');
          await runReleaseFromCommit(suggestedBump);
          releaseDone = true;
        }
      }

      if (currentBranchAfterCommit === developmentBranch && !releaseDone) {
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