import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { confirm } from "@inquirer/prompts";
import { matchIntent } from "./intentMatcher.js";
import { dispatchIntent } from "./dispatch.js";
import { getVoiceConfigPath, readVoiceConfig } from "./config.js";
import { speakText } from "./sound.js";
import {
  generateJarvisScript,
  openTerminalRunningScript,
  cleanupOldScripts,
} from "./terminal-output.js";
import { appendToTerminal } from "./ephemeral-terminal.js";
import {
  printBox,
  info,
  warn,
  error,
  success,
  dim,
  blank,
  section,
  chalk,
  muted,
} from "../ui.js";

/**
 * Rotulo colorido para o nivel de confianca do match.
 * @param {string} confidence
 * @returns {string}
 */
export function confidenceLabel(confidence) {
  switch (confidence) {
    case "high": return chalk.green("alta");
    case "medium": return chalk.yellow("media");
    case "low": return muted("baixa");
    default: return muted("-");
  }
}

/**
 * Roda o dispatchIntent capturando tudo que vai pra console.log.
 * Retorna as linhas capturadas pra TTS.
 *
 * @param {{ argv: string[] }} result
 * @returns {Promise<{ ok: boolean|string, lines: string[], error: Error|null }>}
 */
async function runDispatchCapturing(result) {
  const originalLog = console.log;
  const lines = [];
  let ok = false;
  let error_ = null;

  console.log = (...args) => {
    originalLog(...args);
    try {
      const line = args
        .map((a) => (typeof a === 'string' ? a : String(a)))
        .join(' ')
        .trim();
      if (line) lines.push(line);
    } catch {
      // ignora
    }
  };

  try {
    ok = await dispatchIntent(result.argv);
  } catch (err) {
    error_ = err;
  } finally {
    console.log = originalLog;
  }

  return { ok, lines, error: error_ };
}

/**
 * Filtra as linhas capturadas para falar algo útil.
 * Ignora linhas puramente decorativas, spinners, etc.
 *
 * @param {string[]} lines
 * @returns {string}
 */
function buildSpeechFromLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return '';

  const useful = lines.filter((line) => {
    const t = line.replace(/[│─╭╮╯╰═║╔╗╚╝]/g, '').trim();
    if (!t) return false;
    // Ignora linhas só com símbolos
    if (!/[\p{L}\p{N}]/u.test(t)) return false;
    // Ignora spinners
    if (/^[✔√✖✗⚠ℹ·]$/.test(t)) return false;
    return true;
  });

  return useful.join('. ');
}

/**
 * Executa o comando internamente (mesmo terminal). Se TTS estiver ligado,
 * fala o resultado.
 *
 * @param {{ argv: string[] }} result
 */
async function executeInline(result) {
  const argvStr = result.argv.join(" ");
  const cfg = readVoiceConfig();

  // O VBS de startup inicia o Jarvis com cwd = home do usuario.
  // Sem isso, comandos como status/commit/pull falham com
  // "nao e um repositorio Git". Entao pulamos pro ultimo projeto usado.
  try {
    const prefsPath = path.join(os.homedir(), ".jarvis", "preferences.json");
    if (fs.existsSync(prefsPath)) {
      const prefs = JSON.parse(fs.readFileSync(prefsPath, "utf-8"));
      if (prefs.lastProjectPath && fs.existsSync(prefs.lastProjectPath)) {
        process.chdir(prefs.lastProjectPath);
      }
    }
  } catch {
    // silencioso: se falhar, segue com o cwd atual
  }

  const { ok, lines, error: dispatchErr } = await runDispatchCapturing(result);

  if (dispatchErr) {
    error("Erro ao executar: " + dispatchErr.message);
    if (cfg.ttsEnabled) {
      speakText("Erro ao executar o comando.");
    }
    return;
  }

  if (ok === "help") {
    const { printCatalogBoxes } = await import("../commands/menu.js");
    printCatalogBoxes();
    if (cfg.ttsEnabled) {
      speakText("Aqui estão os comandos disponíveis.");
    }
    return;
  }

  if (!ok) {
    warn("Comando '" + argvStr + "' ainda nao e suportado no modo voz.");
    dim("  (os comandos suportados estao listados no topo do dispatch.js)");
    if (cfg.ttsEnabled) {
      speakText("Este comando ainda não é suportado por voz.");
    }
    return;
  }

  // Se estamos no modo session-window, escreve o output na janela minimizada
  if (cfg.voiceOutputMode === "session-window") {
    const header = "\n> jarvis " + argvStr + "\n";
    appendToTerminal(header + lines.join("\n"));
  }

  // TTS — fala o resultado capturado
  if (cfg.ttsEnabled) {
    const speech = buildSpeechFromLines(lines);
    if (speech) {
      speakText(speech, { maxChars: cfg.ttsMaxChars ?? 300 });
    }
  }
}

/**
 * Executa o comando abrindo em nova aba/janela de terminal.
 * @param {{ argv: string[] }} result
 * @param {"new-tab"|"new-window"} mode
 */
async function executeInNewTerminal(result, mode) {
  const argvStr = result.argv.join(" ");
  const cwd = process.cwd();

  cleanupOldScripts();

  let scriptPath;
  try {
    scriptPath = generateJarvisScript(result.argv, cwd);
  } catch (err) {
    warn("Falha ao gerar script: " + err.message);
    dim("  Caindo para modo same-terminal...");
    blank();
    return executeInline(result);
  }

  const opened = openTerminalRunningScript(scriptPath, mode);

  if (!opened.ok) {
    warn(opened.message);
    dim("  Caindo para modo same-terminal...");
    blank();
    return executeInline(result);
  }

  success(opened.message);
  dim("  Comando:  jarvis " + argvStr);
  dim("  Script:   " + scriptPath);
  dim("  (a janela fica aberta para voce ver o resultado)");

  // TTS opcional: só avisa que executou (não tem output pra capturar)
  const cfg = readVoiceConfig();
  if (cfg.ttsEnabled) {
    speakText("Comando " + argvStr + " executado em nova janela.");
  }
}

/**
 * Executa o comando casado pelo intent matcher, respeitando
 * voiceOutputMode (same-terminal / new-tab / new-window).
 *
 * @param {{ argv: string[], intent?: string }} result
 */
export async function executeIntent(result) {
  const argvStr = result.argv.join(" ");
  const cfg = readVoiceConfig();
  const mode = cfg.voiceOutputMode || "same-terminal";

  blank();

  if (mode === "new-tab" || mode === "new-window") {
    info("Executando: jarvis " + argvStr + " (em nova " + (mode === "new-tab" ? "aba" : "janela") + ")");
    blank();
    await executeInNewTerminal(result, mode);
    return;
  }

  // session-window roda inline (mesmo processo) mas escreve no terminal efemero
  info("Executando: jarvis " + argvStr);
  blank();
  await executeInline(result);
}

/**
 * Mostra o resultado do match e executa (padrao) ou pergunta (--confirm).
 *
 * @param {string} text
 * @param {{ run?: boolean, execute?: boolean, confirm?: boolean }} [opts]
 */
export async function handleText(text, opts = {}) {
  const result = matchIntent(text);

  if (!result.intent) {
    warn("Nenhum comando reconhecido.");
    blank();
    dim("Tente frases como:");
    dim("  . \"o que eu tenho hoje\"");
    dim("  . \"lista do jira\"");
    dim("  . \"status do projeto\"");
    dim("  . \"relatorio da task SDG-71\"");
    blank();

    const cfg = readVoiceConfig();
    if (cfg.ttsEnabled) {
      speakText("Não reconheci nenhum comando.");
    }
    return;
  }

  const argvStr = result.argv.join(" ");

  printBox(
    chalk.bold("Intent") + "       " + result.intent + "\n" +
    chalk.bold("Comando") + "      jarvis " + argvStr + "\n" +
    chalk.bold("Confianca") + "    " + confidenceLabel(result.confidence) +
      (result.matchedBy ? " " + muted("(" + result.matchedBy + ")") : "") + "\n" +
    chalk.bold("Descricao") + "    " + (result.description || "-"),
    { title: "reconhecimento", borderColor: "green" }
  );
  blank();

  if (opts.confirm) {
    const shouldRun = await confirm({
      message: "Executar este comando?",
      default: true,
    });

    if (!shouldRun) {
      dim("Nao executado.");
      const cfg = readVoiceConfig();
      if (cfg.ttsEnabled) {
        speakText("Comando cancelado.");
      }
      return;
    }
  } else if (!opts.execute) {
    dim("  (modo simulacao - use --run para executar o comando de verdade)");
    return;
  }

  await executeIntent(result);
}

/**
 * Mostra o que falta para usar o modo --ouvir / --wake.
 * @param {object} deps - resultado de checkVoiceDependencies()
 */
export function printMissingDependencies(deps) {
  blank();
  warn("Captura de voz nao esta pronta neste ambiente.");
  blank();

  if (!deps.recorder.ok) {
    section("Gravador de audio");
    console.log(deps.recorder.reason);
    blank();
  }

  if (!deps.whisper.ok) {
    section("whisper.cpp");
    console.log(deps.whisper.reason);
    blank();
  }

  if (!deps.model.ok) {
    section("Modelo do whisper");
    console.log(deps.model.reason);
    blank();
  }

  if (deps.recorder.ok && !deps.audioDevice && process.platform === "win32") {
    section("Dispositivo de audio (Windows)");
    console.log(
      "Nenhum microfone foi detectado automaticamente.\n" +
      "  Rode: jarvis voz --listar-microfones"
    );
    blank();
  }

  dim("Config: " + getVoiceConfigPath());
  blank();
}
