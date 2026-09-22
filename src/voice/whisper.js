import { spawn } from 'node:child_process';
import fs from 'node:fs';

/**
 * Executa o whisper.cpp e retorna o texto transcrito.
 *
 * @param {string} audioPath
 * @param {{
 *   whisperPath: string,
 *   modelPath: string,
 *   language?: string,
 *   timeoutMs?: number,
 * }} options
 * @returns {Promise<{ text: string, raw: string }>}
 */
export function transcribeWithWhisper(audioPath, options) {
  const {
    whisperPath,
    modelPath,
    language = 'pt',
    timeoutMs = 120000,
    prompt = null,
    threads = 4,
  } = options;

  if (!fs.existsSync(audioPath)) {
    return Promise.reject(new Error(`Arquivo de áudio não encontrado: ${audioPath}`));
  }
  if (!fs.existsSync(modelPath)) {
    return Promise.reject(new Error(`Modelo do whisper não encontrado: ${modelPath}`));
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-m', modelPath,
      '-f', audioPath,
      '-l', language,
      '-nt',
      '-t', String(threads),
    ];

    // Prompt priming: enviesa vocabulário para o domínio do Jarvis
    if (prompt) {
      args.push('--prompt', prompt);
    }

    const child = spawn(whisperPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timeoutHandle = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error('Timeout ao transcrever com whisper.cpp.'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutHandle);
      reject(new Error(`Falha ao executar whisper.cpp: ${err.message}`));
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutHandle);

      if (code !== 0) {
        const detail = stderr.trim().split('\n').slice(-5).join('\n');
        reject(new Error(
          `whisper.cpp encerrou com código ${code}.\n` +
          (detail ? `  Últimas linhas:\n${detail}` : '  Sem saída de erro.')
        ));
        return;
      }

      const text = parseWhisperOutput(stdout);
      resolve({ text, raw: stdout });
    });
  });
}

export const DEFAULT_WHISPER_PROMPT =
  'Jarvis. Lista do Jira. Minhas tarefas. O que eu tenho hoje. ' +
  'Status do projeto. Relatório da task. Mover task. Issues do Jira. ' +
  'Fazer commit. Atualizar repositório.';

/**
 * Extrai texto puro da saída do whisper.cpp.
 * Lida com dois formatos:
 *   - Com timestamps:  [00:00:00.000 --> 00:00:03.000]  texto
 *   - Sem timestamps:  texto puro
 *
 * Também remove ruídos comuns ([BLANK_AUDIO], (música), etc.).
 *
 * @param {string} raw
 * @returns {string}
 */
export function parseWhisperOutput(raw) {
  if (!raw) return '';

  const lines = raw.split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    let text = line;

    // Remove timestamps se existirem
    text = text.replace(/^\s*\[[\d:.,\s\->]+\]\s*/, '');

    // Remove ruídos comuns emitidos pelo modelo
    text = text
      .replace(/\[BLANK_AUDIO\]/gi, '')
      .replace(/\(silêncio\)/gi, '')
      .replace(/\(silence\)/gi, '')
      .replace(/\[MÚSICA\]/gi, '')
      .replace(/\[MUSIC\]/gi, '')
      .replace(/\(música\)/gi, '')
      .replace(/\(music\)/gi, '');

    text = text.trim();
    if (text) out.push(text);
  }

  return out.join(' ').replace(/\s+/g, ' ').trim();
}