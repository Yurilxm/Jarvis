import { parseVoskLine } from "../src/voice/vosk/listener.js";
import { printMissingVoskDependencies } from "../src/voice/vosk/wake-loop.js";

describe("vosk listener — parseVoskLine", () => {
  it("reconhece __WAKE__ como wake", () => {
    const r = parseVoskLine("__WAKE__");
    expect(r).toEqual({ type: "wake" });
  });

  it("reconhece READY como ready", () => {
    const r = parseVoskLine("READY");
    expect(r).toEqual({ type: "ready" });
  });

  it("reconhece STOPPED como stopped", () => {
    const r = parseVoskLine("STOPPED");
    expect(r).toEqual({ type: "stopped" });
  });

  it("linha vazia retorna null", () => {
    expect(parseVoskLine("")).toBeNull();
    expect(parseVoskLine("   ")).toBeNull();
    expect(parseVoskLine(null)).toBeNull();
    expect(parseVoskLine(undefined)).toBeNull();
  });

  it("linha qualquer vira log", () => {
    const r = parseVoskLine("INFO: carregando modelo");
    expect(r).toEqual({ type: "log", text: "INFO: carregando modelo" });
  });

  it("aceita variacoes com espacos", () => {
    expect(parseVoskLine("  __WAKE__  ")).toEqual({ type: "wake" });
    expect(parseVoskLine("\tREADY\n")).toEqual({ type: "ready" });
  });
});

describe("vosk wake-loop — printMissingVoskDependencies", () => {
  it("nao lanca com python/model/script faltando", () => {
    expect(() => {
      printMissingVoskDependencies({
        python: { ok: false, reason: "python nao encontrado" },
        model: { ok: false, reason: "modelo nao encontrado" },
        script: { ok: false, path: "/tmp/fake.py" },
        ok: false,
        missing: ["python", "model", "script"],
      });
    }).not.toThrow();
  });

  it("nao lanca com tudo ok", () => {
    expect(() => {
      printMissingVoskDependencies({
        python: { ok: true },
        model: { ok: true },
        script: { ok: true, path: "/x" },
        ok: true,
        missing: [],
      });
    }).not.toThrow();
  });
});
