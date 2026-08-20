import { isGitRepo, getGitStatus } from '../git/status.js';
import { getSafeDiff } from '../git/diff.js';
import { sanitizeDiff, filterSensitiveFiles } from '../commit/sanitize.js';
import { buildDocsPrompt } from './promptBuilder.js';
import { askAI } from '../ai/client.js';
import { confirm, input } from '@inquirer/prompts';
import fs from 'node:fs';
import path from 'node:path';
import { getDirectoryTree, getKeyFiles, readFileContent } from '../utils/project-reader.js';
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
const MAX_CONTEXT_CHARS = 15000;

/**
 * Fluxo de geração de documentação.
 * @param {string} docType - 'readme' ou 'changelog'
 */
export async function runDocsFlow(docType = 'readme') {
  printBanner();

  if (!isGitRepo()) {
    error('Este diretório não é um repositório Git.');
    process.exitCode = 1;
    return;
  }

  const outputFile = docType === 'changelog' ? 'CHANGELOG.md' : 'README.md';
  const outputPath = path.join(process.cwd(), outputFile);

  const status = getGitStatus();
  const allFiles = [...status.staged, ...status.modified, ...status.untracked];
  const uniqueFiles = [...new Set(allFiles)];

  let diffToUse = '';
  let projectContext = '';

  // Se for README e não houver alterações no Git, gerar documentação a partir
  // da estrutura do projeto (árvore + arquivos principais).
  if (docType === 'readme' && uniqueFiles.length === 0) {
    const rootDir = process.cwd();
    const projectName = path.basename(rootDir);
    const tree = getDirectoryTree(rootDir, 3);
    const keyFiles = getKeyFiles(rootDir, [
      '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss', '.less',
      '.json', '.md', '.py', '.php', '.rb', '.go', '.java', '.cs',
      '.sql', '.yml', '.yaml', '.env.example', '.txt',
    ]);

    let filesContent = '';
    let totalChars = tree.length;

    for (const file of keyFiles.slice(0, 15)) {
      const content = readFileContent(file.path);
      const sanitized = sanitizeDiff(content).sanitized;
      const chunk = `\n### ${path.relative(rootDir, file.path)} (${file.size} bytes)\n\`\`\`\n${sanitized}\n\`\`\`\n`;
      if (totalChars + chunk.length > MAX_CONTEXT_CHARS) break;
      filesContent += chunk;
      totalChars += chunk.length;
    }

    projectContext = `Projeto: ${projectName}\n\n## Estrutura de diretórios\n${tree}\n\n## Arquivos principais\n${filesContent}`;
    info('Nenhuma alteração detectada. Gerando documentação baseada na estrutura do projeto...');
  } else {
    // Se for changelog sem alterações, não faz sentido gerar/atualizar.
    if (docType === 'changelog' && uniqueFiles.length === 0) {
      info('Nenhuma alteração detectada. Changelog não será atualizado.');
      return;
    }

    const { safe } = filterSensitiveFiles(uniqueFiles);

    const safeSet = new Set(safe.length > 0 ? safe : uniqueFiles);
    const safeUntracked = status.untracked.filter((f) => safeSet.has(f));
    const safeTracked = (safe.length > 0 ? safe : uniqueFiles).filter((f) => !safeUntracked.includes(f));

    const rawDiff = getSafeDiff({ tracked: safeTracked, untracked: safeUntracked });
    const { sanitized } = sanitizeDiff(rawDiff);

    diffToUse = sanitized.substring(0, MAX_DIFF_SIZE);
  }

  // Se o arquivo já existe, incluir conteúdo atual no prompt para atualização
  let existingContent = '';
  if (fs.existsSync(outputPath)) {
    existingContent = fs.readFileSync(outputPath, 'utf-8');
  }

  const prompt = buildDocsPrompt(diffToUse, docType, existingContent, projectContext);

  // Gerar proposta
  let docContent;
  const gen = spinner(`Gerando ${outputFile}...`);
  gen.start();
  try {
    docContent = await askAI(prompt);
    gen.succeed('Documentação gerada.');
  } catch (err) {
    gen.fail('Erro ao comunicar com a IA');
    error(err.message);
    process.exitCode = 1;
    return;
  }

  // Loop de aprovação (igual ao commit)
  while (true) {
    blank();
    if (existingContent && existingContent !== docContent) {
      // Mostrar diff visual: linhas adicionadas em verde, removidas em vermelho
      section(`Alterações em ${outputFile}:`);
      const existingLines = existingContent.split('\n');
      const newLines = docContent.split('\n');
      const maxLen = Math.max(existingLines.length, newLines.length);

      let addedCount = 0;
      let removedCount = 0;

      for (let i = 0; i < maxLen; i++) {
        const oldLine = existingLines[i];
        const newLine = newLines[i];

        if (oldLine === newLine) {
          // Linha igual: mostra normal se estiver nas primeiras/últimas 3, senão pula
          if (i < 3 || i > maxLen - 4) {
            console.log(dim(`  ${oldLine || ''}`));
          } else if (i === 3 && maxLen > 8) {
            console.log(dim('  ...'));
          }
        } else {
          if (oldLine !== undefined) {
            console.log(chalk.red(`- ${oldLine}`));
            removedCount++;
          }
          if (newLine !== undefined) {
            console.log(chalk.green(`+ ${newLine}`));
            addedCount++;
          }
        }
      }

      blank();
      info(`${chalk.green(`+${addedCount} adições`)}  ${chalk.red(`-${removedCount} remoções`)}`);
      blank();
    } else {
      // Arquivo novo: mostrar conteúdo completo
      printBox(docContent, { title: `novo: ${outputFile}`, borderColor: 'green' });
    }

    const action = await input({
      message: 'O que deseja fazer? (a)provar e salvar / (e)ditar / (g)erar novamente / (c)ancelar',
      validate: (value) => {
        const v = value.toLowerCase();
        if (['a', 'e', 'g', 'c'].includes(v)) return true;
        return 'Digite a, e, g ou c';
      }
    });

    const choice = action.toLowerCase();

    if (choice === 'c') {
      info('Geração cancelada.');
      return;
    }

    if (choice === 'a') {
      break;
    }

    if (choice === 'e') {
      docContent = await input({
        message: 'Edite o conteúdo:',
        default: docContent,
      });
      break;
    }

    if (choice === 'g') {
      const regen = spinner('Gerando novamente...');
      regen.start();
      try {
        docContent = await askAI(prompt);
        regen.succeed('Nova versão gerada.');
      } catch (err) {
        regen.fail('Erro');
        error(err.message);
        process.exitCode = 1;
        return;
      }
    }
  }

  // Verificar se arquivo já existe
  if (fs.existsSync(outputPath)) {
    const overwrite = await confirm({
      message: `${outputFile} já existe. Sobrescrever?`,
      default: false,
    });

    if (!overwrite) {
      info('Salvamento cancelado.');
      return;
    }
  }

  // Salvar
  try {
    fs.writeFileSync(outputPath, docContent, 'utf-8');
    success(`${outputFile} salvo com sucesso!`);
    dim(`Caminho: ${outputPath}`);
  } catch (err) {
    error(`Erro ao salvar arquivo: ${err.message}`);
    process.exitCode = 1;
    return;
  }
}