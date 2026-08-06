import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askAI } from '../ai/client.js';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  spinner,
  chalk,
} from '../ui.js';

export async function runCheck() {
  printBanner();
  info('Executando verificações de segurança...\n');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const cwd = process.cwd();
  const hasPackageJson = fs.existsSync(path.join(cwd, 'package.json'));
  
  // Caminho absoluto para o binário do secretlint no Jarvis
  const jarvisRoot = path.resolve(__dirname, '..', '..');
  const secretlintBin = path.join(jarvisRoot, 'node_modules', '.bin', 'secretlint');
  const secretlintCmd = process.platform === 'win32' ? `${secretlintBin}.cmd` : secretlintBin;
  
  // Caminho absoluto para a regra recomendada
  const rulesPath = path.join(jarvisRoot, 'node_modules', '@secretlint', 'secretlint-rule-preset-recommend');
  
  let toolOutputs = '';

  // 1. npm audit (apenas em projetos Node.js)
  if (hasPackageJson) {
    const spinAudit = spinner('Executando npm audit...');
    spinAudit.start();
    try {
      const auditOutput = execSync('npm audit --json', { encoding: 'utf-8', stdio: 'pipe', cwd });
      const auditJson = JSON.parse(auditOutput);
      if (auditJson.vulnerabilities && Object.keys(auditJson.vulnerabilities).length > 0) {
        toolOutputs += `\n\n### npm audit (vulnerabilidades em dependências)\n`;
        for (const [pkg, details] of Object.entries(auditJson.vulnerabilities)) {
          toolOutputs += `- **${pkg}** (${details.severity}): ${details.title || details.name}\n`;
          if (details.via && Array.isArray(details.via)) {
            for (const via of details.via) {
              if (typeof via === 'object' && via.title) {
                toolOutputs += `  - ${via.title}\n`;
              }
            }
          }
        }
        spinAudit.succeed(`${Object.keys(auditJson.vulnerabilities).length} vulnerabilidades encontradas.`);
      } else {
        spinAudit.succeed('Nenhuma vulnerabilidade conhecida encontrada.');
        toolOutputs += '\n\n### npm audit\nNenhuma vulnerabilidade conhecida em dependências.';
      }
    } catch (err) {
      spinAudit.fail('Falha ao executar npm audit. O projeto pode não ter dependências instaladas.');
      toolOutputs += '\n\n### npm audit\nFalha na execução.';
    }
  }

  // 2. secretlint (scanner de segredos)
  const spinSecret = spinner('Executando scanner de segredos (secretlint)...');
  spinSecret.start();
  
  // Criar configuração temporária no diretório do projeto alvo
  const tempConfigPath = path.join(cwd, '.secretlintrc-temp.json');
  const userConfigPath = path.join(cwd, '.secretlintrc.json');
  let configCreated = false;

  try {
    if (!fs.existsSync(userConfigPath)) {
      const ignoreConfig = {
        rules: [
          {
            id: rulesPath, // Usar caminho absoluto para o preset
          }
        ],
        filter: {
          '**/.git/**': true,
          '**/node_modules/**': true,
          '**/venv/**': true,
          '**/__pycache__/**': true,
          '**/migrations/**': true,
          '**/staticfiles/**': true,
          '**/media/**': true,
          '**/*.jpg': true,
          '**/*.png': true,
          '**/*.gif': true,
          '**/*.ico': true,
          '**/*.woff': true,
          '**/*.ttf': true,
          '**/*.eot': true,
          '**/package-lock.json': true,
        },
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(ignoreConfig, null, 2), 'utf-8');
      configCreated = true;
    }

    // Sempre usa o arquivo temporário se criado, senão o do usuário
    const configPathToUse = configCreated ? tempConfigPath : userConfigPath;

    let rawOutput;
    let realFailure = false;
    let failureDetail = '';

    try {
      rawOutput = execSync(`"${secretlintCmd}" "**/*" --format json --secretlintrc "${configPathToUse}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      });
    } catch (execErr) {
      if (execErr.stdout && execErr.stdout.trim()) {
        rawOutput = execErr.stdout;
      } else {
        realFailure = true;
        failureDetail = execErr.stderr || execErr.message || 'motivo desconhecido';
      }
    }

    if (realFailure) {
      spinSecret.fail('Scanner de segredos não pôde ser executado.');
      toolOutputs += `\n\n### secretlint\nFalha real na execução (não foi possível verificar segredos): ${failureDetail}`;
    } else {
      try {
        const secretlintJson = JSON.parse(rawOutput);
        // Filtra apenas os achados com ruleId definido (segredos reais)
        const realFindings = secretlintJson.filter(f => f.ruleId && f.ruleId !== 'undefined');
        
        if (realFindings.length > 0) {
          toolOutputs += `\n\n### secretlint (possíveis segredos no código)\n`;
          for (const finding of realFindings) {
            toolOutputs += `- **${finding.filePath}**: ${finding.message} (regra: ${finding.ruleId})\n`;
          }
          spinSecret.succeed(`${realFindings.length} segredos ou chaves expostas encontrados.`);
        } else {
          spinSecret.succeed('Nenhum segredo ou chave exposta encontrada.');
          toolOutputs += '\n\n### secretlint\nNenhum segredo ou chave exposta encontrado.';
        }
      } catch (parseErr) {
        spinSecret.fail('Erro ao processar resultados do scanner.');
        toolOutputs += '\n\n### secretlint\nErro ao analisar a saída da ferramenta.';
      }
    }
  } catch (err) {
    spinSecret.fail('Scanner de segredos não pôde ser executado.');
    toolOutputs += `\n\n### secretlint\nFalha na execução: ${err.message}`;
  } finally {
    if (configCreated && fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  }

  // Montar prompt para a IA contextualizar os achados
  const prompt = `Você é um especialista em segurança de software. 
Recebi os seguintes resultados de ferramentas de verificação automática no meu projeto:

${toolOutputs}

Com base APENAS nesses resultados, explique em português claro:
1. Quais são os riscos mais importantes e por quê.
2. Se algum dos achados parece ser um falso positivo.
3. Ações recomendadas para resolver os problemas (priorize os mais críticos).

Regras:
- Não sugira ferramentas adicionais.
- Não faça diagnósticos sem base nos dados fornecidos.
- Se não houver achados, diga que está tudo limpo.`;

  const spinAI = spinner('Consultando a IA para explicar os resultados...');
  spinAI.start();
  try {
    const analysis = await askAI(prompt);
    spinAI.succeed('Análise concluída!');

    blank();
    printBox(analysis, { title: '🔒 Resultados da Verificação de Segurança', borderColor: 'cyan' });
    
    // Aviso obrigatório
    blank();
    warn('Aviso importante:');
    dim('Esta análise é baseada em ferramentas automatizadas (npm audit, secretlint) e IA.');
    dim('Ela NÃO substitui uma auditoria de segurança profissional, especialmente em projetos');
    dim('que processam pagamentos ou dados sensíveis de clientes.');
    blank();
  } catch (err) {
    spinAI.fail('Erro ao comunicar com a IA');
    error(err.message);
  }
}