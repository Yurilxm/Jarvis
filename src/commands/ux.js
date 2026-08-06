import path from 'node:path';
import { askAI } from '../ai/client.js';
import { sanitizeDiff } from '../commit/sanitize.js';
import { getDirectoryTree, getKeyFiles, readFileContent } from '../utils/project-reader.js';
import {
  printBanner, printBox, info, success, error, dim, blank, spinner,
} from '../ui.js';

const MAX_TOTAL_CHARS = 15000;

export async function runUX() {
  printBanner();
  info('Analisando usabilidade do frontend...\n');

  const rootDir = process.cwd();
  const projectName = path.basename(rootDir);
  
  // Foco em frontend: templates, estilos e scripts
  const extensions = ['.html', '.jsx', '.tsx', '.css', '.scss', '.less', '.js', '.ts'];
  const tree = getDirectoryTree(rootDir);
  const keyFiles = getKeyFiles(rootDir, extensions);
  
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

  const prompt = `Você é um especialista em UX (experiência do usuário). Analise os arquivos de frontend do projeto abaixo e forneça uma análise de usabilidade em português.

Projeto: ${projectName}

## Estrutura de diretórios (frontend)
${tree}

## Arquivos de frontend
${filesContent}

Responda no seguinte formato:

## 🖥️ Visão Geral do Frontend
[2-3 frases descrevendo a tecnologia usada no frontend e o fluxo principal do usuário]

## 🔍 Fluxo Principal
- [análise do fluxo mais importante (ex: compra, cadastro)]
- [clareza das etapas]

## ⚠️ Pontos de Atenção
- [problemas de usabilidade encontrados]
- [campos de formulário sem validação aparente]
- [feedback visual ausente em ações]

## 💡 Sugestões de UX
- [melhorias específicas]
- [padrões de acessibilidade recomendados]

Regras:
1. Seja específico e baseado APENAS no que viu nos arquivos
2. Use português claro
3. NÃO diga que o design é "bom" ou "ruim" — apenas analise
4. Inclua o aviso: "Esta é uma sugestão de UX baseada em análise estática de código, não um teste com usuários reais."`;

  const spin = spinner('Consultando a IA...');
  spin.start();
  
  try {
    const analysis = await askAI(prompt);
    spin.succeed('Análise concluída!');
    blank();
    printBox(analysis, { title: `🎨 análise de UX: ${projectName}`, borderColor: 'cyan' });
    blank();
    dim('Esta é uma análise somente-leitura. Nenhuma alteração foi feita no código.');
  } catch (err) {
    spin.fail('Erro ao comunicar com a IA');
    error(err.message);
  }
}