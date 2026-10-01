import fs from 'node:fs';
import path from 'node:path';
import { confirm, input } from '@inquirer/prompts';
import {
  extractTextFromImage,
  extractTextWithGemini,
  validateImageFile,
} from './ocr.js';
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

function timestampSuffix(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}-${hh}${mm}`;
}

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

function normalizeOutputPath(raw, defaultDir = 'transcricoes') {
  const inputStr = String(raw || '').trim();
  if (!inputStr) return '';

  const hasDir = /[\\/]/.test(inputStr);
  let candidate = hasDir ? inputStr : path.join(defaultDir, inputStr);

  if (!path.extname(candidate)) {
    candidate = `${candidate}.txt`;
  }

  return candidate;
}

/**
 * Fluxo: jarvis transcrever <imagem> [--local | --ia]
 *
 * Modos:
 *  - auto  (padrão): roda RapidOCR local; se confiança baixa, oferece IA
 *  - local: só RapidOCR (offline, sem cota)
 *  - ia:    só Gemini Vision
 *
 * @param {string} imagePath
 * @param {{ mode?: 'auto'|'local'|'ia' }} [opts]
 */
export async function runTranscribe(imagePath, opts = {}) {
  printBanner();

  const mode = opts.mode || 'auto';

  if (!imagePath) {
    error('Informe o caminho de uma imagem. Ex: jarvis transcrever captura.png');
    dim('  Flags opcionais: --local (só OCR local) ou --ia (Gemini Vision)');
    process.exitCode = 1;
    return;
  }

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
  if (mode === 'local') dim('  Modo: apenas OCR local (RapidOCR)');
  if (mode === 'ia') dim('  Modo: Gemini Vision');
  blank();

  // ─── Extração ────────────────────────────────────────────────────────────
  const spinLabel = mode === 'ia'
    ? 'Enviando para Gemini Vision...'
    : 'Extraindo texto (RapidOCR local)...';
  const spin = spinner(spinLabel);
  spin.start();

  let result;
  try {
    result = await extractTextFromImage(absolute, { mode });
  } catch (err) {
    spin.fail('Erro ao processar a imagem');
    error(err.message);
    process.exitCode = 1;
    return;
  }

  // ─── Modo auto: mostra resultado local; se duvidoso, oferece IA ─────────
  let shownInAutoBlock = false;

  if (mode === 'auto' && result.needsAI && result.text) {
    const pct = Math.round((result.confidence || 0) * 100);
    const qualPct = Math.round((result.quality || 0) * 100);
    spin.succeed('OCR local concluído.');
    blank();

    // Mostra o resultado local primeiro — assim o usuário vê o que foi lido
    printBox(result.text, {
      title: `leitura local · confiança ${pct}%`,
      borderColor: 'yellow',
    });
    blank();

    // Diagnóstico: por que estamos oferecendo IA?
    const lowConf = (result.confidence || 0) < 0.9;
    const lowQual = (result.quality || 0) > 0.15;
    if (lowConf && lowQual) {
      warn(`Leitura pode estar ruim (confiança ${pct}%, ${qualPct}% de palavras estranhas).`);
    } else if (lowConf) {
      warn(`Confiança baixa (${pct}%).`);
    } else {
      warn(`${qualPct}% das palavras parecem fora do português.`);
    }
    dim('  Isso é comum com manuscrito, letra cursiva ou fotos ruins.');
    blank();

    const useAI = await confirm({
      message: 'Usar Gemini Vision para uma leitura melhor? (consome 1 requisição)',
      default: true,
    });

    if (useAI) {
      const aiSpin = spinner('Enviando para Gemini Vision...');
      aiSpin.start();
      try {
        const aiResult = await extractTextWithGemini(absolute);
        aiSpin.succeed('Transcrição IA concluída.');
        result = {
          text: aiResult.text,
          lines: [],
          confidence: null,
          quality: null,
          engine: 'gemini-vision',
        };
        blank();
        printBox(result.text, {
          title: 'leitura IA · Gemini Vision',
          borderColor: 'green',
        });
        blank();
      } catch (err) {
        aiSpin.fail('Erro no Gemini Vision');
        error(err.message);
        blank();
        const msg = err.message || '';
        if (msg.includes('503')) {
          warn('A API Gemini está sobrecarregada no momento.');
          dim('  Tente novamente em alguns minutos:');
          dim(`    jarvis transcrever "${fileName}" --ia`);
        } else if (/cota|quota|429/i.test(msg)) {
          warn('Cota da Gemini esgotada no momento.');
          dim('  Aguarde algumas horas ou verifique seu plano.');
        } else {
          dim('  Mantendo o resultado do OCR local.');
        }
        blank();
      }
    }

    shownInAutoBlock = true;
  } else if (mode === 'auto' && result.text) {
    const pct = Math.round((result.confidence || 0) * 100);
    spin.succeed(`Texto extraído (confiança ${pct}%).`);
  } else if (mode === 'ia' && result.text) {
    spin.succeed('Transcrição IA concluída.');
  } else if (!result.text) {
    spin.succeed('OCR concluído, mas nenhum texto foi detectado.');
  }

  const text = result.text;

  if (!text) {
    blank();
    warn('Nenhum texto legível foi encontrado na imagem.');
    if (mode === 'local') {
      dim('  Dica: se a imagem for manuscrito ou estiver torta, tente sem --local:');
      dim('    jarvis transcrever "' + fileName + '"');
    }
    return;
  }

  // ─── Resultado final ─────────────────────────────────────────────────────
  // Se o bloco de "leitura local" já imprimiu o texto (modo auto com needsAI),
  // não duplicar.
  if (!shownInAutoBlock) {
    blank();
    const engineLabel = result.engine === 'gemini-vision' ? 'IA (Gemini)' : 'RapidOCR (local)';
    printBox(text, { title: `transcrição · ${fileName} · ${engineLabel}`, borderColor: 'cyan' });
    blank();
  }

  // ─── Clipboard ───────────────────────────────────────────────────────────
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

  // ─── Salvar em arquivo ───────────────────────────────────────────────────
  const shouldSave = await confirm({
    message: 'Salvar a transcrição em arquivo?',
    default: false,
  });

  if (!shouldSave) {
    blank();
    if (result.engine === 'gemini-vision') {
      dim('Transcrição via Gemini Vision. Imagem enviada para os servidores do Google.');
    } else {
      dim('OCR local (RapidOCR via Python). Nenhuma informação foi enviada para a internet.');
    }
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

  const relPreview = path.relative(process.cwd(), outPath) || outPath;
  info(`Salvando em: ${chalk.cyan(relPreview)}`);

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

  try {
    const gi = ensureGitignoreEntry('transcricoes/');
    if (gi.added) {
      dim(`  ${gi.created ? 'Criado' : 'Atualizado'} .gitignore (adicionado: transcricoes/).`);
    }
  } catch {
    // silencioso
  }

  blank();
  if (result.engine === 'gemini-vision') {
    dim('Transcrição via Gemini Vision. Imagem enviada para os servidores do Google.');
  } else {
    dim('OCR local (RapidOCR via Python). Nenhuma informação foi enviada para a internet.');
  }
}