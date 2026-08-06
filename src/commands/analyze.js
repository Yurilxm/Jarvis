import fs from 'node:fs';
import path from 'node:path';
import { askAI } from '../ai/client.js';
import { sanitizeDiff } from '../commit/sanitize.js';
import { getDirectoryTree, getKeyFiles, readFileContent } from '../utils/project-reader.js';
import {
  printBanner,
  printBox,
  info,
  error,
  dim,
  blank,
  spinner,
} from '../ui.js';

const MAX_TOTAL_CHARS = 15000;

export async function runAnalyze() {
  printBanner();
  info('Analisando estrutura do projeto...\n');

  const rootDir = process.cwd();
  const projectName = path.basename(rootDir);

  const tree = getDirectoryTree(rootDir);
  const keyFiles = getKeyFiles(rootDir, ['.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml', '.cfg', '.ini', '.env.example', '.txt']);

  // Garantir que configurações principais sejam incluídas
  const configNames = ['settings.py', 'urls.py', 'manage.py', 'package.json', 'requirements.txt', 'docker-compose.yml', 'Dockerfile', '.env.example', 'README.md'];
  for (const name of configNames) {
    const configPath = path.join(rootDir, name);
    if (fs.existsSync(configPath) && !keyFiles.some(f => f.path === configPath)) {
      keyFiles.unshift({ path: configPath, size: fs.statSync(configPath).size });
    }
  }

  let filesContent = '';
  let totalChars = tree.length;

  for (const file of keyFiles.slice(0, 15)) {
    const content = readFileContent(file.path);
    const sanitized = sanitizeDiff(content).sanitized;
    const chunk = `\n### ${path.relative(rootDir, file.path)} (${file.size} bytes)\n\`\`\`\n${sanitized}\n\`\`\`\n`;
    if (totalChars + chunk.length > MAX_TOTAL_CHARS) break;
    filesContent += chunk;
    totalChars += chunk.length;
  }

  const prompt = `Você é um arquiteto de software sênior. Analise a estrutura e os arquivos principais do projeto abaixo e forneça um panorama arquitetural em português.

Projeto: ${projectName}

## Estrutura de diretórios
${tree}

## Arquivos principais
${filesContent}

Responda no seguinte formato:

## 🏗️ Visão Geral
[2-3 frases descrevendo o que é este projeto, sua stack principal e seu propósito]

## 📁 Estrutura de diretórios
- [análise da organização das pastas]
- [se a separação de responsabilidades está clara]

## ⚠️ Pontos de atenção
- [áreas com concentração excessiva de código]
- [possíveis problemas de organização]

## 💡 Sugestões
- [melhorias de arquitetura]
- [padrões recomendados]

Regras:
1. Seja específico e baseado APENAS no que viu nos arquivos
2. Não invente funcionalidades que não estão no código
3. Use português claro
4. NÃO sugira refatorações drásticas — seja pragmático`;

  const spin = spinner('Consultando a IA...');
  spin.start();

  try {
    const analysis = await askAI(prompt);
    spin.succeed('Análise concluída!');
    blank();
    printBox(analysis, { title: `📊 análise do projeto: ${projectName}`, borderColor: 'cyan' });
    blank();
    dim('Esta é uma análise somente-leitura. Nenhuma alteração foi feita no código.');
  } catch (err) {
    spin.fail('Erro ao comunicar com a IA');
    error(err.message);
  }
}