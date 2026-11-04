/**
 * Resumos de fala por intent.
 *
 * O TTS nao deve ler o output cru do comando. Cada intent tem um
 * resumidor que devolve uma string curta (ou null para cair no fallback,
 * que le as linhas).
 *
 * As linhas vem do console.log capturado pelo runDispatchCapturing em
 * handlers.js. Alguns boxes do boxen vem com \n embutido, entao o
 * flatten() achata tudo antes de casar.
 */

/**
 * Remove ANSI, normaliza acentos e espacos. Torna os matches tolerantes.
 *
 * @param {string} s
 * @returns {string}
 */
function sanitize(s) {
  return String(s)
    .replace(/\x1b\[[0-9;]*m/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Achata as linhas (boxes com \n embutido) e sanitiza cada uma.
 *
 * @param {string[]} lines
 * @returns {string[]}
 */
function flatten(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .flatMap((l) => String(l).split(/\r?\n/))
    .map(sanitize)
    .filter(Boolean);
}

/**
 * Conta issues Jira (linhas tipo "SDG-123  titulo").
 *
 * @param {string[]} lines
 * @returns {number}
 */
function countJiraKeys(lines) {
  return lines.filter((l) => /^[A-Z]{2,}-\d+\s/.test(l)).length;
}

/**
 * Conta PRs (linhas tipo "#12  titulo").
 *
 * @param {string[]} lines
 * @returns {number}
 */
function countPrKeys(lines) {
  return lines.filter((l) => /^#\d+\s/.test(l)).length;
}

/**
 * Extrai o valor de um campo "Label  valor" das linhas.
 *
 * @param {string[]} lines
 * @param {RegExp} regex
 * @returns {string|null}
 */
function extractField(lines, regex) {
  for (const l of lines) {
    const m = l.match(regex);
    if (m) return m[1].trim();
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// Status
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeStatus(lines) {
  const branchLine = lines.find((l) => /^Branch\s+/.test(l));
  if (!branchLine) return null;

  const branch = branchLine
    .replace(/^Branch\s+/, '')
    .replace(/\s*\(protegida\).*$/, '')
    .trim();

  if (lines.some((l) => /arvore de trabalho limpa/i.test(l))) {
    return `Branch ${branch}. Arvore de trabalho limpa.`;
  }

  const changedLine = lines.find((l) => /arquivo\(s\) com alteracoes/i.test(l));
  if (changedLine) {
    const m = changedLine.match(/(\d+)\s+arquivo/i);
    if (m) {
      const n = Number(m[1]);
      return `Branch ${branch}. ${n} ${n === 1 ? 'arquivo alterado' : 'arquivos alterados'}.`;
    }
  }

  return `Branch ${branch}.`;
}

// ═════════════════════════════════════════════════════════════════════
// Jira list / Jira list done / Jira list all
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @param {string} label - "ativas", "concluidas", "no total"
 * @returns {string}
 */
function summarizeJiraList(lines, label) {
  const count = countJiraKeys(lines);
  if (count === 0) return `Nenhuma tarefa ${label}.`;
  if (count === 1) return `Voce tem 1 tarefa ${label}.`;
  return `Voce tem ${count} tarefas ${label}.`;
}

// ═════════════════════════════════════════════════════════════════════
// PR list
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string}
 */
function summarizePrList(lines) {
  const count = countPrKeys(lines);
  if (count === 0) return 'Nenhuma PR aberta.';
  if (count === 1) return 'Voce tem 1 PR aberta.';
  return `Voce tem ${count} PRs abertas.`;
}

// ═════════════════════════════════════════════════════════════════════
// Today
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string}
 */
function summarizeToday(lines) {
  const issues = countJiraKeys(lines);
  const prs = countPrKeys(lines);

  const parts = [];
  if (issues > 0) {
    parts.push(issues === 1 ? '1 issue ativa' : `${issues} issues ativas`);
  }
  if (prs > 0) {
    parts.push(prs === 1 ? '1 PR aberta' : `${prs} PRs abertas`);
  }

  if (parts.length === 0) return 'Resumo do dia pronto.';
  return `Voce tem ${parts.join(' e ')}.`;
}

// ═════════════════════════════════════════════════════════════════════
// Jira view (este LE detalhes, a pedido)
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeJiraView(lines) {
  const title = extractField(lines, /^Titulo\s+(.+)/);
  const status = extractField(lines, /^Status\s+(.+)/);
  const assignee = extractField(lines, /^Responsavel\s+(.+)/);

  // Chave: linha contendo "SDG-123" (pode estar no titulo do box)
  let key = null;
  for (const l of lines) {
    const m = l.match(/\b([A-Z]{2,}-\d+)\b/);
    if (m) { key = m[1]; break; }
  }

  if (!title && !key) return null;

  const parts = [];
  if (key && title) parts.push(`Task ${key}: ${title}`);
  else if (title) parts.push(`Task: ${title}`);
  else if (key) parts.push(`Task ${key}`);

  if (status) parts.push(`Status: ${status}`);
  if (assignee) parts.push(`Responsavel: ${assignee}`);

  return parts.join('. ') + '.';
}

// ═════════════════════════════════════════════════════════════════════
// Jira move / create
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeJiraMove(lines) {
  for (const l of lines) {
    const m = l.match(/([A-Z]{2,}-\d+)\s+movida com sucesso/i);
    if (m) return `Task ${m[1]} movida.`;
  }
  if (lines.some((l) => /movida com sucesso/i.test(l))) return 'Task movida.';
  return null;
}

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeJiraCreate(lines) {
  for (const l of lines) {
    const m = l.match(/([A-Z]{2,}-\d+)\s+criada com sucesso/i);
    if (m) return `Task ${m[1]} criada.`;
  }
  if (lines.some((l) => /criada com sucesso/i.test(l))) return 'Task criada.';
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// Scan
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeScan(lines) {
  const count = lines.filter((l) => /[A-Z]:\\|\/(home|Users|opt|var)\//i.test(l)).length;
  if (count === 0) return null;
  if (count === 1) return '1 projeto encontrado.';
  return `${count} projetos encontrados.`;
}

// ═════════════════════════════════════════════════════════════════════
// Commit
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeCommit(lines) {
  const hasCommit = lines.some((l) => /Commit realizado com sucesso/i.test(l));
  const hasPush = lines.some((l) => /Push realizado com sucesso/i.test(l));
  if (!hasCommit && !hasPush) return null;
  if (hasCommit && hasPush) return "Commit feito e enviado.";
  if (hasPush) return "Push enviado.";
  return "Commit feito.";
}

// ═════════════════════════════════════════════════════════════════════
// Pull
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizePull(lines) {
  // Git output: "Already up to date." / "N files changed, M insertions(+), ..."
  const joined = lines.join(" ");
  if (/Already up to date|Ja atualizado|já atualizado/i.test(joined)) {
    return "Ja estava atualizado.";
  }
  const m = joined.match(/(\d+)\s+files?\s+changed/i);
  if (m) {
    const n = Number(m[1]);
    return `Atualizado. ${n} ${n === 1 ? "arquivo alterado" : "arquivos alterados"}.`;
  }
  if (lines.some((l) => /Repositorio atualizado|Repositório atualizado/i.test(l))) {
    return "Repositorio atualizado.";
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// History
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeHistory(lines) {
  for (const l of lines) {
    const m = l.match(/hist[oó]rico\s*[·\-]\s*(\d+)\s+evento/i);
    if (m) {
      const n = Number(m[1]);
      if (n === 0) return "Nenhum evento no historico.";
      return n === 1 ? "1 evento no historico." : `Ultimos ${n} eventos no historico.`;
    }
  }
  if (lines.some((l) => /Nenhum evento ainda/i.test(l))) {
    return "Nenhum evento no historico.";
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// Docs
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeDocs(lines) {
  for (const l of lines) {
    const m = l.match(/([\w.-]+\.(md|MD))\s+salvo com sucesso/i);
    if (m) {
      const file = m[1].toUpperCase();
      if (file.includes("CHANGELOG")) return "Changelog atualizado.";
      if (file.includes("README")) return "Readme atualizado.";
      return file + " atualizado.";
    }
  }
  if (lines.some((l) => /salvo com sucesso/i.test(l))) {
    return "Documento atualizado.";
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// Review
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeReview(lines) {
  if (lines.some((l) => /revis[aã]o de c[oó]digo/i.test(l))) {
    return "Revisao concluida. Veja os detalhes no terminal.";
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// Undo
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeUndo(lines) {
  if (lines.some((l) => /commit desfeito|desfeito com sucesso|soft reset/i.test(l))) {
    return "Commit desfeito.";
  }
  if (lines.some((l) => /nenhum commit para desfazer|nada para desfazer/i.test(l))) {
    return "Nao havia commit para desfazer.";
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// Release
// ═════════════════════════════════════════════════════════════════════

/**
 * @param {string[]} lines
 * @returns {string|null}
 */
function summarizeRelease(lines) {
  for (const l of lines) {
    const m = l.match(/vers[aã]o\s+v?(\d+\.\d+\.\d+)/i);
    if (m) return `Versao ${m[1]} criada.`;
  }
  for (const l of lines) {
    const m = l.match(/tag\s+v?(\d+\.\d+\.\d+)/i);
    if (m) return `Versao ${m[1]} criada.`;
  }
  if (lines.some((l) => /release criada|tag criada/i.test(l))) {
    return "Nova versao criada.";
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════
// Dispatcher
// ═════════════════════════════════════════════════════════════════════

/**
 * Retorna um resumo curto para falar, ou null para usar o fallback
 * (buildSpeechFromLines em handlers.js).
 *
 * @param {string|undefined} intent
 * @param {string[]} argv
 * @param {string[]} lines
 * @param {object} [cfg]
 * @returns {string|null}
 */
export function summarizeForSpeech(intent, argv, lines, cfg = {}) {
  const clean = flatten(lines);
  if (clean.length === 0) return null;

  switch (intent) {
    case 'status': return summarizeStatus(clean);
    case 'jira-list': return summarizeJiraList(clean, 'ativas');
    case 'jira-list-done': return summarizeJiraList(clean, 'concluidas');
    case 'jira-list-all': return summarizeJiraList(clean, 'no total');
    case 'pr-list': return summarizePrList(clean);
    case 'today': return summarizeToday(clean);
    case 'jira-view': return summarizeJiraView(clean);
    case 'jira-move': return summarizeJiraMove(clean);
    case 'jira-create': return summarizeJiraCreate(clean);
    case 'scan': return summarizeScan(clean);
    case 'commit': return summarizeCommit(clean);
    case 'pull': return summarizePull(clean);
    case 'history': return summarizeHistory(clean);
    case 'docs-changelog': return summarizeDocs(clean);
    case 'docs-readme': return summarizeDocs(clean);
    case 'review': return summarizeReview(clean);
    case 'undo': return summarizeUndo(clean);
    case 'release': return summarizeRelease(clean);
    default: return null;
  }
}
