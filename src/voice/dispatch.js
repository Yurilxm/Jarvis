/**
 * Dispatcher do Jarvis Voz — chama o comando correspondente ao intent.
 * Reaproveita os mesmos módulos que a CLI usa, sem child_process.
 */

/**
 * @param {string[]} argv - argumentos no formato ['comando', 'sub?', 'arg?']
 * @returns {Promise<boolean>} true se o comando foi reconhecido
 */
export async function dispatchIntent(argv) {
  const [cmd, sub, arg] = argv || [];

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
    if (sub === 'create') {
      const { jiraCreate } = await import('../jira/flow.js');
      await jiraCreate();
      return true;
    }
  }

  if (cmd === 'pr') {
    if (sub === 'list') {
      const { prList } = await import('../pr/flow.js');
      await prList();
      return true;
    }
  }

  if (cmd === 'branch') {
    if (sub === 'list') {
      const { handleBranchCommand } = await import('../commands/branch.js');
      await handleBranchCommand('list');
      return true;
    }
  }

  return false;
}