import {
  WAKE_VARIANTS,
  normalizeText,
  isWakeWordMatch,
  findWakeWordInText,
} from "../src/voice/vosk/wakewords.js";

describe("vosk — normalizeText", () => {
  it("remove acentos e coloca em minusculas", () => {
    expect(normalizeText("JARVIS")).toBe("jarvis");
    expect(normalizeText("Járvis")).toBe("jarvis");
    expect(normalizeText("JARVÍS")).toBe("jarvis");
  });

  it("lida com vazio/nulo", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(123)).toBe("");
  });
});

describe("vosk — isWakeWordMatch", () => {
  it("detecta 'jarvis' isolado", () => {
    expect(isWakeWordMatch("jarvis")).toBe(true);
  });

  it("detecta 'jarvis' dentro de frase", () => {
    expect(isWakeWordMatch("ei jarvis tudo bem")).toBe(true);
    expect(isWakeWordMatch("oi jarvis, lista do jira")).toBe(true);
  });

  it("detecta variantes foneticas", () => {
    expect(isWakeWordMatch("jardim")).toBe(true);
    expect(isWakeWordMatch("jervis")).toBe(true);
    expect(isWakeWordMatch("jarvs")).toBe(true);
    expect(isWakeWordMatch("jarwis")).toBe(true);
  });

  it("ignora acentos e maiusculas", () => {
    expect(isWakeWordMatch("JARVIS")).toBe(true);
    expect(isWakeWordMatch("Járvis")).toBe(true);
  });

  it("NAO detecta quando nao ha variante", () => {
    expect(isWakeWordMatch("lista do jira")).toBe(false);
    expect(isWakeWordMatch("faz um commit")).toBe(false);
    expect(isWakeWordMatch("")).toBe(false);
    expect(isWakeWordMatch(null)).toBe(false);
  });

  it("NAO detecta substring (so palavra completa)", () => {
    // "jarvisalgo" NAO deve matchar
    expect(isWakeWordMatch("jarvisalgo")).toBe(false);
    // "ojarvis" NAO deve matchar
    expect(isWakeWordMatch("ojarvis")).toBe(false);
  });

  it("detecta no meio de frase longa", () => {
    expect(isWakeWordMatch("bom dia, jarvis, me manda a lista das tasks")).toBe(true);
  });
});

describe("vosk — findWakeWordInText", () => {
  it("retorna a variante encontrada", () => {
    expect(findWakeWordInText("jarvis")).toBe("jarvis");
    expect(findWakeWordInText("oi jardim tudo bem")).toBe("jardim");
  });

  it("retorna null quando nao ha match", () => {
    expect(findWakeWordInText("lista do jira")).toBeNull();
    expect(findWakeWordInText("")).toBeNull();
  });
});

describe("vosk — WAKE_VARIANTS", () => {
  it("inclui 'jarvis' como variante base", () => {
    expect(WAKE_VARIANTS).toContain("jarvis");
  });

  it("inclui 'jardim' (transcricao observada do Vosk)", () => {
    expect(WAKE_VARIANTS).toContain("jardim");
  });

  it("nao tem duplicatas", () => {
    const set = new Set(WAKE_VARIANTS);
    expect(set.size).toBe(WAKE_VARIANTS.length);
  });
});
