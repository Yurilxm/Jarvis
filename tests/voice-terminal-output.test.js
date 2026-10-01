import {
  escapePowerShellSingleQuoted,
  buildJarvisScriptContent,
  generateJarvisScript,
} from "../src/voice/terminal-output.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("voice terminal-output — escapePowerShellSingleQuoted", () => {
  it("escapa single quote duplicando", () => {
    expect(escapePowerShellSingleQuoted("it's")).toBe("it''s");
    expect(escapePowerShellSingleQuoted("a'b'c")).toBe("a''b''c");
  });

  it("nao mexe quando nao ha quote", () => {
    expect(escapePowerShellSingleQuoted("abc")).toBe("abc");
    expect(escapePowerShellSingleQuoted("")).toBe("");
  });

  it("converte nao-strings", () => {
    expect(escapePowerShellSingleQuoted(123)).toBe("123");
    expect(escapePowerShellSingleQuoted(null)).toBe("null");
  });
});

describe("voice terminal-output — buildJarvisScriptContent", () => {
  it("inclui Set-Location com cwd escapado", () => {
    const content = buildJarvisScriptContent(
      ["jira", "list"],
      "C:\\Users\\O'Brien\\proj"
    );
    expect(content).toContain("Set-Location -LiteralPath 'C:\\Users\\O''Brien\\proj'");
  });

  it("inclui comando jarvis com args single-quoted", () => {
    const content = buildJarvisScriptContent(["jira", "list"], "C:\\tmp");
    expect(content).toContain("jarvis 'jira' 'list'");
  });

  it("escapa args com apóstrofo", () => {
    const content = buildJarvisScriptContent(["report", "it's"], "C:\\tmp");
    expect(content).toContain("jarvis 'report' 'it''s'");
  });

  it("lida com argv vazio", () => {
    const content = buildJarvisScriptContent([], "C:\\tmp");
    expect(content).toContain("jarvis ");
  });

  it("usa CRLF como separador de linha", () => {
    const content = buildJarvisScriptContent(["x"], "C:\\tmp");
    expect(content).toContain("\r\n");
  });

  it("tem cabecalho com comentario", () => {
    const content = buildJarvisScriptContent(["x"], "C:\\tmp");
    expect(content).toMatch(/^# Script temporario/);
  });
});

describe("voice terminal-output — generateJarvisScript", () => {
  it("cria arquivo .ps1 temporario", () => {
    const p = generateJarvisScript(["status"], process.cwd());
    try {
      expect(fs.existsSync(p)).toBe(true);
      expect(p).toMatch(/\.ps1$/);
      const content = fs.readFileSync(p, "utf-8");
      expect(content).toContain("jarvis 'status'");
    } finally {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
  });

  it("cria arquivos com nomes unicos", async () => {
    const p1 = generateJarvisScript(["a"], process.cwd());
    await new Promise((r) => setTimeout(r, 5));
    const p2 = generateJarvisScript(["b"], process.cwd());
    try {
      expect(p1).not.toBe(p2);
    } finally {
      try { fs.unlinkSync(p1); } catch { /* ignore */ }
      try { fs.unlinkSync(p2); } catch { /* ignore */ }
    }
  });
});
