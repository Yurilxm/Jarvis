import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { findInPath } from './dependencies.js';
import { readVoiceConfig } from './config.js';
import { checkPiperDependencies } from './piper/dependencies.js';

/**
 * Toca um "plim" curto para sinalizar a wake word. Usa ffplay (que vem
 * com ffmpeg). Retorna true se o som foi disparado (assincrono).
 *
 * @param {string} [customPath] - arquivo customizado (.wav/.mp3)
 * @returns {boolean}
 */
export function playWakeSound(customPath) {
  const cfg = readVoiceConfig();

  if (cfg.wakeSound === false) return false;

  const ffplay = findInPath('ffplay');
  if (!ffplay) return false;

  const soundPath = customPath || cfg.wakeSoundPath;

  let args;
  if (soundPath && fs.existsSync(soundPath)) {
    args = ['-nodisp', '-autoexit', '-loglevel', 'quiet', soundPath];
  } else {
    args = [
      '-nodisp', '-autoexit', '-loglevel', 'quiet',
      '-f', 'lavfi',
      '-i', 'sine=frequency=880:duration=0.12',
    ];
  }

  try {
    const child = spawn(ffplay, args, {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Limpa um texto para ser falado: remove caracteres que nao sao PT/EN
 * basicos, colapsa espacos, corta no limite.
 *
 * @param {string} text
 * @param {number} [maxChars=300]
 * @returns {string}
 */
export function prepareForSpeech(text, maxChars = 300) {
  if (!text || typeof text !== 'string') return '';

  const cleaned = String(text)
    // remove ANSI codes e emojis
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    // remove decoracoes de box (│ ─ ╭ ╮ etc)
    .replace(/[│─╭╮╯╰═║╔╗╚╝]/g, ' ')
    // colapsa espacos
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= maxChars) return cleaned;

  // Corta no ultimo espaco antes do limite
  const truncated = cleaned.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.7 ? truncated.slice(0, lastSpace) : truncated) + '.';
}

/**
 * Toca um arquivo .wav via ffplay em background (detached).
 *
 * @param {string} wavPath
 * @returns {boolean}
 */
function playWavDetached(wavPath) {
  const ffplay = findInPath('ffplay');
  if (!ffplay) return false;

  try {
    const child = spawn(
      ffplay,
      ['-nodisp', '-autoexit', '-loglevel', 'quiet', wavPath],
      { stdio: 'ignore', detached: true }
    );
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Fala um texto usando System.Speech do Windows (via PowerShell) — motor SAPI.
 * Retorna true se o comando foi disparado (assincrono).
 *
 * @param {string} prepared - texto ja sanitizado
 * @param {{ voice?: string, rate?: number }} opts
 * @returns {boolean}
 */
function speakWithSapi(prepared, opts = {}) {
  const cfg = readVoiceConfig();
  const voice = opts.voice || cfg.ttsVoice || '';
  const rate = opts.rate ?? cfg.ttsRate ?? 1;

  // System.Speech.Synthesis usa Rate de -10 a 10 (0 = normal).
  const psRate = Math.max(-10, Math.min(10, Math.round((rate - 1) * 5)));

  const voiceLine = voice
    ? `try { $synth.SelectVoice('${voice.replace(/'/g, "''")}') } catch { }`
    : '';

  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    voiceLine,
    `$synth.Rate = ${psRate}`,
    `$synth.Speak('${prepared.replace(/'/g, "''")}')`,
    '$synth.Dispose()',
  ].filter(Boolean).join('\r\n');

  const scriptPath = path.join(
    os.tmpdir(),
    'jarvis-voz',
    `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`
  );

  try {
    if (!fs.existsSync(path.dirname(scriptPath))) {
      fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    }
    fs.writeFileSync(scriptPath, script, 'utf-8');

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { stdio: 'ignore', detached: true, windowsHide: true }
    );
    child.unref();

    setTimeout(() => {
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
    }, 60000).unref();

    return true;
  } catch {
    return false;
  }
}

/**
 * Fala um texto usando Piper (piper-tts via Python) — motor neural local.
 *
 * Fluxo:
 *   1. Gera um .wav temporario via `python -m piper` (texto vai por stdin).
 *   2. Toca o .wav com ffplay em background.
 *   3. Limpa o .wav depois de 60s.
 *
 * Se as dependencias estiverem OK, retorna true. Se nao estiverem, faz
 * fallback para SAPI e avisa o usuario.
 *
 * @param {string} prepared - texto ja sanitizado
 * @param {{ voice?: string, rate?: number }} opts
 * @returns {boolean}
 */
function speakWithPiper(prepared, opts = {}) {
  const cfg = readVoiceConfig();

  const deps = checkPiperDependencies(cfg);
  if (!deps.ok) {
    // Aviso unico e claro, sem travar o fluxo
    console.warn(
      '[jarvis voz] Piper nao esta pronto; usando SAPI como fallback.'
    );
    if (!deps.python.ok) console.warn('  - ' + deps.python.reason);
    if (!deps.model.ok) console.warn('  - ' + deps.model.reason);
    return speakWithSapi(prepared, opts);
  }

  const wavPath = path.join(
    os.tmpdir(),
    'jarvis-voz',
    `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`
  );

  try {
    if (!fs.existsSync(path.dirname(wavPath))) {
      fs.mkdirSync(path.dirname(wavPath), { recursive: true });
    }

    // O texto vai como ARGUMENTO (nao via stdin). No Windows, stdin de um
    // processo Python usa o codepage do sistema (cp1252), o que quebra
    // acentos ("Arvore", "main (protegida)") que vem do output dos comandos.
    // Passando como argumento, o spawnSync cuida do encoding via Node.
    const args = [
      ...deps.python.python.args,
      '-m', 'piper',
      '-m', deps.model.path,
      '-f', wavPath,
      prepared,
    ];

    // PYTHONUTF8=1 forca Python em modo UTF-8 em qualquer lugar.
    const result = spawnSync(deps.python.python.cmd, args, {
      timeout: 20000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    });

    if (result.status !== 0 || !fs.existsSync(wavPath)) {
      console.warn('[jarvis voz] Piper falhou ao gerar o audio; usando SAPI.');
      if (result.stderr) {
        // Mostra as ultimas 3 linhas do traceback (o erro real fica no final)
        const lines = String(result.stderr).trim().split('\n');
        const relevant = lines.slice(-3).map((l) => '  ' + l).join('\n');
        console.warn(relevant);
      }
      return speakWithSapi(prepared, opts);
    }

    // Toca em background e limpa depois
    const played = playWavDetached(wavPath);
    setTimeout(() => {
      try { fs.unlinkSync(wavPath); } catch { /* ignore */ }
    }, 60000).unref();

    return played;
  } catch (err) {
    console.warn('[jarvis voz] Erro ao invocar Piper: ' + err.message);
    return speakWithSapi(prepared, opts);
  }
}

/**
 * Fala um texto usando o motor configurado (Piper ou SAPI).
 *
 * A assinatura publica nao muda: quem chama (handlers.js) so precisa saber
 * que o texto sera falado. O motor e escolhido por `ttsEngine` no voice.json.
 *
 * @param {string} text
 * @param {{ voice?: string, rate?: number, maxChars?: number }} [opts]
 * @returns {boolean}
 */
export function speakText(text, opts = {}) {
  if (process.platform !== 'win32') return false;

  const cfg = readVoiceConfig();
  if (cfg.ttsEnabled === false) return false;

  const maxChars = opts.maxChars ?? cfg.ttsMaxChars ?? 300;
  const prepared = prepareForSpeech(text, maxChars);
  if (!prepared) return false;

  const engine = (cfg.ttsEngine || 'sapi').toLowerCase();
  if (engine === 'piper') {
    return speakWithPiper(prepared, opts);
  }
  return speakWithSapi(prepared, opts);
}

/**
 * Variante BLOQUEANTE de speakText: retorna uma Promise que resolve quando
 * o audio termina de tocar (ou apos timeout de seguranca).
 *
 * Usado pelo wake-loop pra garantir que o greeting/despedida terminou ANTES
 * de abrir a captura do comando. Sem isso, o proprio audio do Jarvis vira
 * input do microfone e o Whisper transcreve a fala dele misturada com a sua.
 *
 * @param {string} text
 * @param {{ voice?: string, rate?: number, maxChars?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
export async function speakTextAwait(text, opts = {}) {
  if (process.platform !== 'win32') return false;

  const cfg = readVoiceConfig();
  if (cfg.ttsEnabled === false) return false;

  const maxChars = opts.maxChars ?? cfg.ttsMaxChars ?? 300;
  const prepared = prepareForSpeech(text, maxChars);
  if (!prepared) return false;

  const engine = (cfg.ttsEngine || 'sapi').toLowerCase();
  if (engine === 'piper') {
    return await speakWithPiperAwait(prepared, opts);
  }
  return await speakWithSapiAwait(prepared, opts);
}

/**
 * Toca um WAV com ffplay e aguarda o processo filho terminar.
 *
 * @param {string} wavPath
 * @param {number} [timeoutMs=30000]
 * @returns {Promise<boolean>}
 */
function playWavAwait(wavPath, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const ffplay = findInPath('ffplay');
    if (!ffplay) {
      console.warn('[jarvis voz] ffplay nao encontrado; sem audio.');
      return resolve(false);
    }

    let resolved = false;
    const done = (val) => {
      if (resolved) return;
      resolved = true;
      resolve(val);
    };

    let child;
    try {
      child = spawn(
        ffplay,
        ['-nodisp', '-autoexit', '-loglevel', 'quiet', wavPath],
        { stdio: 'ignore', windowsHide: true }
      );
    } catch (err) {
      console.warn('[jarvis voz] Falha ao invocar ffplay: ' + err.message);
      return done(false);
    }

    const t = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      done(false);
    }, timeoutMs);
    t.unref();

    child.on('exit', () => {
      clearTimeout(t);
      done(true);
    });
    child.on('error', () => {
      clearTimeout(t);
      done(false);
    });
  });
}

/**
 * Piper BLOQUEANTE: gera o WAV, toca e so retorna quando o ffplay sai.
 * Cai para SAPI se as dependencias do Piper estiverem ausentes.
 *
 * @param {string} prepared
 * @param {object} opts
 * @returns {Promise<boolean>}
 */
async function speakWithPiperAwait(prepared, opts = {}) {
  const cfg = readVoiceConfig();

  const deps = checkPiperDependencies(cfg);
  if (!deps.ok) {
    console.warn('[jarvis voz] Piper nao esta pronto; usando SAPI como fallback.');
    if (!deps.python.ok) console.warn('  - ' + deps.python.reason);
    if (!deps.model.ok) console.warn('  - ' + deps.model.reason);
    return await speakWithSapiAwait(prepared, opts);
  }

  const wavPath = path.join(
    os.tmpdir(),
    'jarvis-voz',
    `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`
  );

  try {
    if (!fs.existsSync(path.dirname(wavPath))) {
      fs.mkdirSync(path.dirname(wavPath), { recursive: true });
    }

    const args = [
      ...deps.python.python.args,
      '-m', 'piper',
      '-m', deps.model.path,
      '-f', wavPath,
      prepared,
    ];

    const genResult = spawnSync(deps.python.python.cmd, args, {
      timeout: 20000,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    });

    if (genResult.status !== 0 || !fs.existsSync(wavPath)) {
      console.warn('[jarvis voz] Piper falhou ao gerar o audio; usando SAPI.');
      if (genResult.stderr) {
        const lines = String(genResult.stderr).trim().split('\n');
        const relevant = lines.slice(-3).map((l) => '  ' + l).join('\n');
        console.warn(relevant);
      }
      return await speakWithSapiAwait(prepared, opts);
    }

    const played = await playWavAwait(wavPath);

    setTimeout(() => {
      try { fs.unlinkSync(wavPath); } catch { /* ignore */ }
    }, 5000).unref();

    return played;
  } catch (err) {
    console.warn('[jarvis voz] Erro ao invocar Piper: ' + err.message);
    return await speakWithSapiAwait(prepared, opts);
  }
}

/**
 * SAPI BLOQUEANTE: gera o script PowerShell, executa e so retorna quando
 * o processo termina (ou seja, quando a voz terminou de tocar).
 *
 * @param {string} prepared
 * @param {object} opts
 * @returns {Promise<boolean>}
 */
async function speakWithSapiAwait(prepared, opts = {}) {
  const cfg = readVoiceConfig();
  const voice = opts.voice || cfg.ttsVoice || '';
  const rate = opts.rate ?? cfg.ttsRate ?? 1;
  const psRate = Math.max(-10, Math.min(10, Math.round((rate - 1) * 5)));

  const voiceLine = voice
    ? `try { $synth.SelectVoice('${voice.replace(/'/g, "''")}') } catch { }`
    : '';

  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    voiceLine,
    `$synth.Rate = ${psRate}`,
    `$synth.Speak('${prepared.replace(/'/g, "''")}')`,
    '$synth.Dispose()',
  ].filter(Boolean).join('\r\n');

  const scriptPath = path.join(
    os.tmpdir(),
    'jarvis-voz',
    `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`
  );

  try {
    if (!fs.existsSync(path.dirname(scriptPath))) {
      fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    }
    fs.writeFileSync(scriptPath, script, 'utf-8');

    const ok = await new Promise((resolve) => {
      let resolved = false;
      const done = (val) => {
        if (resolved) return;
        resolved = true;
        resolve(val);
      };

      let child;
      try {
        child = spawn(
          'powershell.exe',
          ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
          { stdio: 'ignore', windowsHide: true }
        );
      } catch (err) {
        return done(false);
      }

      const t = setTimeout(() => {
        try { child.kill(); } catch { /* ignore */ }
        done(false);
      }, 30000);
      t.unref();

      child.on('exit', () => { clearTimeout(t); done(true); });
      child.on('error', () => { clearTimeout(t); done(false); });
    });

    setTimeout(() => {
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
    }, 60000).unref();

    return ok;
  } catch {
    return false;
  }
}

/**
 * Verifica se uma voz especifica existe no sistema (SAPI).
 * @param {string} voiceName
 * @returns {boolean}
 */
export function hasVoice(voiceName) {
  if (process.platform !== 'win32') return false;
  try {
    const out = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command',
        'Add-Type -AssemblyName System.Speech; ' +
        '(New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ' +
        'ForEach-Object { $_.VoiceInfo.Name }'],
      { encoding: 'utf-8', timeout: 5000 }
    ).stdout || '';
    return out.split(/\r?\n/).some((l) => l.trim() === voiceName);
  } catch {
    return false;
  }
}
