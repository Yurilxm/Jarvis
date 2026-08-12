import path from 'node:path';
import { discoverProjects } from '../utils/project-scanner.js';
import { loadProjectConfig } from '../config/project.js';
import {
  printBanner,
  printBox,
  info,
  success,
  dim,
  blank,
  section,
  chalk,
  muted,
} from '../ui.js';

/**
 * Lista projetos Git nas subpastas, mantendo o vínculo na raiz (cwd).
 * @param {{ maxDepth?: number }} [options]
 */
export function showProjects({ maxDepth = 4 } = {}) {
  printBanner();

  const result = discoverProjects(process.cwd(), { maxDepth });
  const config = loadProjectConfig();
  const rootName = path.basename(result.root);

  const configLine = config
    ? muted(`config ${chalk.white('.jarvis-dev.json')} presente`)
    : muted(`sem ${chalk.white('.jarvis-dev.json')} na raiz`);

  printBox(
    `${chalk.bold('Raiz vinculada')}  ${result.root}\n` +
      `${chalk.bold('Nome')}            ${rootName}\n` +
      `${chalk.bold('Git na raiz')}     ${result.rootIsGit ? chalk.green('sim') : chalk.yellow('não')}\n` +
      `${chalk.bold('Varredura')}       até ${result.maxDepth} nível(is)\n` +
      `${configLine}`,
    { title: 'workspace' }
  );

  dim('Commit/status usam o cwd. Use jarvis (sem args) ou jarvis use para entrar num projeto.');
  blank();

  if (result.projects.length === 0) {
    info(`Nenhum repositório Git encontrado nas subpastas (até profundidade ${result.maxDepth}).`);
    dim('Ex.: pasta-pai/projeto-a/.git  →  jarvis scan');
    blank();
    return result;
  }

  section(`${result.projects.length} projeto(s) encontrado(s)`);

  const lines = result.projects.map((p, i) => {
    const n = String(i + 1).padStart(2, ' ');
    const depth = muted(`d${p.depth}`);
    return `${chalk.cyan(n)}  ${chalk.bold(p.name.padEnd(24))} ${depth}  ${muted(p.relativePath)}`;
  });

  console.log(lines.join('\n'));
  blank();
  success(`Total: ${result.projects.length} projeto(s) sob a raiz vinculada.`);
  blank();

  return result;
}
