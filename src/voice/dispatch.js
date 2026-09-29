/**
 * Dispatcher do Jarvis Voz — chama o comando correspondente ao intent.
 * Reaproveita os mesmos módulos que a CLI usa, sem child_process.
 */

/**
 * @param {string[]} argv - argumentos no formato ['comando', 'sub?', 'arg?']
 * @returns {Promise<boolean|'help'>} true se o comando foi reconhecido
 */
export async function dispatchIntent(argv) {
  const [cmd, sub, arg] = argv || [];

  // ─── Simples ─────────────────────────────────────────────────────────
  if (cmd === 'today') {
    const { runToday } = await import('../commands/today.js');
    await runToday();
    return true;
  }

  if (cmd === 'status') {
    const { showStatus } = await import('../commands/status.js');
    showStatus();
    return true;
  }

  if (cmd === 'history') {
    const { runHistoryView } = await import('../history/view.js');
    await runHistoryView({ limit: 30 });
    return true;
  }

  if (cmd === 'help') {
    return 'help';
  }

  if (cmd === 'commit') {
    const { runCommitFlow } = await import('../commit/flow.js');
    await runCommitFlow();
    return true;
  }

  if (cmd === 'pull') {
    const { runPull } = await import('../commands/pull.js');
    await runPull();
    return true;
  }

  if (cmd === 'undo') {
    const { runUndo } = await import('../commands/undo.js');
    await runUndo();
    return true;
  }

  if (cmd === 'release') {
    const { runRelease } = await import('../commands/release.js');
    await runRelease();
    return true;
  }

  if (cmd === 'scan') {
    const { showProjects } = await import('../commands/projects.js');
    showProjects({ maxDepth: 4 });
    return true;
  }

  if (cmd === 'analyze') {
    const { runAnalyze } = await import('../commands/analyze.js');
    await runAnalyze();
    return true;
  }

  if (cmd === 'ux') {
    const { runUX } = await import('../commands/ux.js');
    await runUX();
    return true;
  }

  if (cmd === 'check') {
    const { runCheck } = await import('../commands/check.js');
    await runCheck();
    return true;
  }

  if (cmd === 'review') {
    const { runReviewFlow } = await import('../review/flow.js');
    await runReviewFlow('all');
    return true;
  }

  if (cmd === 'docs') {
    const { runDocsFlow } = await import('../docs/flow.js');
    await runDocsFlow(sub === 'changelog' ? 'changelog' : 'readme');
    return true;
  }

  if (cmd === 'use') {
    const { selectProjectInteractive } = await import('../commands/switch-project.js');
    await selectProjectInteractive({ force: true });
    return true;
  }

  if (cmd === 'report') {
    const { runReport } = await import('../report/flow.js');
    await runReport(arg);
    return true;
  }

  if (cmd === 'transcrever') {
    // Transcrever precisa de um caminho de imagem — não faz sentido por voz
    // (você não vai ditar o caminho). Orienta o usuário a usar o CLI direto.
    const { warn, dim } = await import('../ui.js');
    warn('jarvis transcrever precisa de um caminho de imagem.');
    dim('  Use o CLI direto: jarvis transcrever caminho\\para\\imagem.png');
    return true;
  }

  // ─── Profile ─────────────────────────────────────────────────────────
  if (cmd === 'profile') {
    const { handleProfileCommand } = await import('../commands/profile.js');
    if (sub === 'show') {
      await handleProfileCommand('show');
      return true;
    }
    if (sub === 'setup') {
      await handleProfileCommand('setup');
      return true;
    }
    if (sub === 'edit') {
      await handleProfileCommand('edit');
      return true;
    }
  }

  // ─── Config ──────────────────────────────────────────────────────────
  if (cmd === 'config') {
    const { runConfig } = await import('../commands/config.js');
    if (sub === 'credentials') {
      await runConfig('credentials');
      return true;
    }
  }

  // ─── Report ──────────────────────────────────────────────────────────
  if (cmd === 'report' && !arg) {
    // Se o intent não trouxe chave, ainda assim roda (modo --since pode
    // ser pedido pelo usuário em outro contexto; aqui apenas avisa).
    return true;
  }

  // ─── Jira ────────────────────────────────────────────────────────────
  if (cmd === 'jira') {
    if (sub === 'list') {
      const { jiraList } = await import('../jira/flow.js');
      await jiraList(arg || 'active');
      return true;
    }
    if (sub === 'view') {
      const { jiraView } = await import('../jira/flow.js');
      await jiraView(arg);
      return true;
    }
    if (sub === 'move') {
      const { jiraMove } = await import('../jira/flow.js');
      await jiraMove(arg);
      return true;
    }
    if (sub === 'edit') {
      const { jiraEdit } = await import('../jira/flow.js');
      await jiraEdit(arg);
      return true;
    }
    if (sub === 'delete') {
      const { jiraDelete } = await import('../jira/flow.js');
      await jiraDelete(arg);
      return true;
    }
    if (sub === 'create') {
      const { jiraCreate } = await import('../jira/flow.js');
      await jiraCreate();
      return true;
    }
  }

  // ─── Pull Requests ───────────────────────────────────────────────────
  if (cmd === 'pr') {
    const flow = await import('../pr/flow.js');
    const prNumber = arg;

    if (sub === 'list') {
      await flow.prList();
      return true;
    }
    if (sub === 'view') {
      await flow.prView(prNumber);
      return true;
    }
    if (sub === 'diff') {
      await flow.prDiff(prNumber);
      return true;
    }
    if (sub === 'review') {
      await flow.prReview(prNumber);
      return true;
    }
    if (sub === 'checkout') {
      await flow.prCheckout(prNumber);
      return true;
    }
    if (sub === 'approve') {
      await flow.prApprove(prNumber);
      return true;
    }
    if (sub === 'merge') {
      await flow.prMerge(prNumber);
      return true;
    }
    if (sub === 'close') {
      await flow.prClose(prNumber);
      return true;
    }
    if (sub === 'comment') {
      await flow.prComment(prNumber);
      return true;
    }
    if (sub === 'request-changes') {
      await flow.prRequestChanges(prNumber);
      return true;
    }
  }

  // ─── Branches ────────────────────────────────────────────────────────
  if (cmd === 'branch') {
    const { handleBranchCommand } = await import('../commands/branch.js');
    if (sub === 'list') {
      await handleBranchCommand('list');
      return true;
    }
    if (sub === 'create') {
      await handleBranchCommand('create', arg);
      return true;
    }
    if (sub === 'switch') {
      await handleBranchCommand('switch', arg);
      return true;
    }
  }

  return false;
}