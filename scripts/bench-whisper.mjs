import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { transcribeWithWhisper, DEFAULT_WHISPER_PROMPT } from "../src/voice/whisper.js";
import { readVoiceConfig } from "../src/voice/config.js";

const AUDIO = process.argv[2] || path.join(os.homedir(), "bench.wav");

if (!fs.existsSync(AUDIO)) {
  console.error("Arquivo de audio nao encontrado: " + AUDIO);
  console.error("Grave com o ffmpeg ou passe o caminho: node scripts/_bench_whisper.mjs <arquivo.wav>");
  process.exit(1);
}

const cfg = readVoiceConfig();
const whisperPath = cfg.whisperPath;
const modelsDir = path.join(os.homedir(), "whisper.cpp", "models");

if (!whisperPath || !fs.existsSync(whisperPath)) {
  console.error("whisper.cpp nao encontrado. Confira whisperPath no voice.json.");
  process.exit(1);
}

const candidates = ["tiny", "base", "small", "medium"];
const models = [];
for (const name of candidates) {
  const p = path.join(modelsDir, "ggml-" + name + ".bin");
  if (fs.existsSync(p)) models.push({ name, path: p });
}

if (models.length === 0) {
  console.error("Nenhum modelo encontrado em " + modelsDir);
  process.exit(1);
}

console.log("Audio:   " + AUDIO);
console.log("Whisper: " + whisperPath);
console.log("Modelos: " + models.map((m) => m.name).join(", "));
console.log("");

const results = [];

for (const m of models) {
  process.stdout.write("[rodando " + m.name + "]...");
  const t0 = Date.now();
  let text = "";
  let err = null;
  try {
    const res = await transcribeWithWhisper(AUDIO, {
      whisperPath,
      modelPath: m.path,
      language: cfg.language || "pt",
      prompt: cfg.whisperPrompt || DEFAULT_WHISPER_PROMPT,
      threads: cfg.whisperThreads || 4,
      timeoutMs: 180000,
    });
    text = res.text;
  } catch (e) {
    err = e.message;
  }
  const dt = Date.now() - t0;
  results.push({ name: m.name, ms: dt, text, err });
  process.stdout.write("\r");
  if (err) {
    console.log("[" + m.name + "] " + dt + "ms  ERRO");
    console.log("   " + err);
  } else {
    console.log("[" + m.name + "] " + dt + "ms");
    console.log("   > " + (text || "(vazio)"));
  }
  console.log("");
}

console.log("=== RESUMO ===");
for (const r of results) {
  const sec = (r.ms / 1000).toFixed(2);
  const label = r.name.padEnd(7);
  if (r.err) {
    console.log(label + " " + sec + "s  ERRO");
  } else {
    console.log(label + " " + sec + "s  " + (r.text || "(vazio)"));
  }
}
