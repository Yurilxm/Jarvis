import fs from 'node:fs';
import path from 'node:path';
import { confirm, input } from '@inquirer/prompts';
import { extractTextFromImage, validateImageFile } from './ocr.js';
import { copyToClipboard } from './clipboard.js';
import { ensureGitignoreEntry } from '../utils/gitignore.js';
import {
  printBanner,
  printBox,
  info,
  success,
  warn,
  error,
  dim,
  blank,
  section,
  spinner,
  chalk,
  muted,
} from '../ui.js';

/**
 * Gera um sufixo de data/hora no formato YYYY-MM-DD-HHMM.
 * @param {Date} [date]
 * @returns {string}
 */
function timestampSuffix(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}-${hh}${mm}`;
}

/**
 * Lista as últimas N transcrições salvas em um diretório.
 * @param {string} dir
 * @param {number} [limit]
 * @returns {string[]}
 */
function listRecentTranscriptions(dir, limit = 5) {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.txt'))
      .map((e) => {
        const full = path.join(dir, e.name);
        const stat = fs.statSync(full);
        return { name: e.name, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit)
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Normaliza o caminho digitado pelo usuário:
 *  - Se não contém separador de pasta, assume transcricoes/<nome>
 *  - Se não tem extensão, adiciona .txt
 *
 * @param {string} raw
 * @param {string} defaultDir - pasta padrão (relativa ao cwd)
 * @returns {string} caminho relativo normalizado
 */
function normalizeOutputPath(raw, defaultDir = 'transcricoes') {
  const input = String(raw || '').trim();
  if (!input) return '';

  // Detecta se o usuário indicou alguma pasta (barra ou contrabarra)
  const hasDir = /[\\/]/.test(input);
  let candidate = hasDir ? input : path.join(defaultDir, input);

  // Se não tem extensão, adiciona .txt
  if (!path.extname(candidate)) {
    candidate = `${candidate}.txt`;
  }

  return candidate;
}

/**
 * Fluxo: jarvis transcrever <imagem>
 * Extrai o texto de uma imagem via OCR local (sem IA).
 *
 * @param {string} imagePath
 */
export async function runTranscribe(imagePath) {
  printBanner();

  if (!imagePath) {
    error('Informe o caminho de uma imagem. Ex: jarvis transcrever captura.png');
    process.exitCode = 1;
    return;
  }

  // 1. Validar o arquivo
  const validation = validateImageFile(imagePath);
  if (!validation.ok) {
    error(validation.reason);
    process.exitCode = 1;
    return;
  }

  const absolute = path.resolve(imagePath);
  const fileName = path.basename(absolute);

  info(`Transcrevendo: ${chalk.cyan(fileName)}`);
  dim(`  ${absolute}`);
  blank();

  // 2. Rodar OCR
  const spin = spinner('Extraindo texto (OCR local)...');
  spin.start();

  let result;
  try {
    result = await extractTextFromImage(absolute);
  } catch (err) {
    spin.fail('Erro ao processar a imagem');
    error(err.message);
    process.exitCode = 1;
    return;
  }

  const text = result.text;

  if (!text) {
    spin.succeed('OCR concluído, mas nenhum texto foi detectado.');
    blank();
    warn('Nenhum texto legível foi encontrado na imagem.');
    return;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  spin.succeed(`Texto extraído (${wordCount} palavra(s), confiança ${Math.round(result.confidence)}%).`);
  blank();

  // 3. Mostrar resultado
  printBox(text, { title: `transcrição · ${fileName}`, borderColor: 'cyan' });
  blank();

  // 4. Copiar para clipboard
  const shouldCopy = await confirm({
    message: 'Copiar o texto para a área de transferência?',
    default: true,
  });

  if (shouldCopy) {
    try {
      await copyToClipboard(text);
      success('Texto copiado para a área de transferência.');
    } catch (err) {
      warn(err.message);
      dim('  (o texto continua impresso acima — copie manualmente se precisar)');
    }
  }

  // 5. Salvar em arquivo
  const shouldSave = await confirm({
    message: 'Salvar a transcrição em arquivo?',
    default: false,
  });

  if (!shouldSave) {
    blank();
    dim('OCR local (tesseract.js). Nenhuma informação foi enviada para a internet.');
    return;
  }

  const transcriptionsDir = path.join(process.cwd(), 'transcricoes');
  if (!fs.existsSync(transcriptionsDir)) {
    try {
      fs.mkdirSync(transcriptionsDir, { recursive: true });
    } catch {
      // se não conseguir criar, salva no cwd
    }
  }

  // Mostra as últimas transcrições salvas para dar contexto
  const recent = listRecentTranscriptions(transcriptionsDir, 5);
  if (recent.length > 0) {
    section('Últimas transcrições salvas');
    for (const name of recent) {
      console.log(`  ${muted('·')} ${name}`);
    }
    blank();
  }

  const baseName = path.basename(fileName, path.extname(fileName));
  const suffix = timestampSuffix();
  const defaultName = `${baseName}-${suffix}.txt`;

  dim('Dica: digite só um nome (ex: resumo-ingles) para salvar em transcricoes/ com .txt.');
  dim('      Para escolher outra pasta, informe o caminho com / ou \\ e a extensão.');
  blank();

  const typed = await input({
    message: 'Nome ou caminho do arquivo:',
    default: defaultName,
    validate: (v) => (v.trim().length > 0 ? true : 'Informe um nome.'),
  });

  const normalizedRel = normalizeOutputPath(typed.trim(), 'transcricoes');
  const outPath = path.resolve(process.cwd(), normalizedRel);

  // Preview do caminho final
  const relPreview = path.relative(process.cwd(), outPath) || outPath;
  info(`Salvando em: ${chalk.cyan(relPreview)}`);

  // Proteção contra sobrescrever
  if (fs.existsSync(outPath)) {
    const overwrite = await confirm({
      message: `${path.basename(outPath)} já existe. Sobrescrever?`,
      default: false,
    });
    if (!overwrite) {
      info('Salvamento cancelado.');
      return;
    }
  }

  // Garante que a pasta existe (caso o usuário tenha indicado outra)
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    try {
      fs.mkdirSync(outDir, { recursive: true });
    } catch (err) {
      error(`Erro ao criar a pasta: ${err.message}`);
      process.exitCode = 1;
      return;
    }
  }

  try {
    fs.writeFileSync(outPath, text, 'utf-8');
    success(`Transcrição salva em ${outPath}`);
  } catch (err) {
    error(`Erro ao salvar: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  // Garante transcricoes/ no .gitignore (não versiona por padrão)
  try {
    const gi = ensureGitignoreEntry('transcricoes/');
    if (gi.added) {
      dim(`  ${gi.created ? 'Criado' : 'Atualizado'} .gitignore (adicionado: transcricoes/).`);
    }
  } catch {
    // silencioso — o .gitignore é só uma conveniência
  }

  blank();
  dim('OCR local (tesseract.js). Nenhuma informação foi enviada para a internet.');
}