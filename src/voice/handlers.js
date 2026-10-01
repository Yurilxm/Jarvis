import { confirm } from "@inquirer/prompts";
import { matchIntent } from "./intentMatcher.js";
import { dispatchIntent } from "./dispatch.js";
import { getVoiceConfigPath, readVoiceConfig } from "./config.js";
import {
  generateJarvisScript,
  openTerminalRunningScript,
  cleanupOldScripts,
} from "./terminal-output.js";
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
 * Executa o comando internamente (mesmo terminal).
 * @param {{ argv: string[] }} result
 */
async function executeInline(result) {
  const argvStr = result.argv.join(" ");
  try {
    const ok = await dispatchIntent(result.argv);
    if (ok === "help") {
      const { printCatalogBoxes } = await import("../commands/menu.js");
      printCatalogBoxes();
    } else if (!ok) {
      warn("Comando '" + argvStr + "' ainda nao e suportado no modo voz.");
      dim("  (os comandos suportados estao listados no topo do dispatch.js)");
    }
  } catch (err) {
    error("Erro ao executar: " + err.message);
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
