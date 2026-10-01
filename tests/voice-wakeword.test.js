import { writeWavFile, rmsLevel } from "../src/voice/wav.js";
import fs from "node:fs";
import path from "node:path";
import { makeTempDir, removeTempDir } from "./helpers/temp.js";

describe("wav — writeWavFile", () => {
  it("gera arquivo com header RIFF/WAVE valido", () => {
    const dir = makeTempDir();
    try {
      const filePath = path.join(dir, "test.wav");
      const pcm = Buffer.alloc(320);
      writeWavFile(filePath, pcm, { sampleRate: 16000 });

      const buf = fs.readFileSync(filePath);
      expect(buf.length).toBe(44 + 320);
      expect(buf.toString("ascii", 0, 4)).toBe("RIFF");
      expect(buf.toString("ascii", 8, 12)).toBe("WAVE");
      expect(buf.readUInt32LE(24)).toBe(16000);
      expect(buf.readUInt16LE(22)).toBe(1);
      expect(buf.readUInt16LE(34)).toBe(16);
      expect(buf.readUInt32LE(40)).toBe(320);
    } finally {
      removeTempDir(dir);
    }
  });

  it("aceita estereo", () => {
    const dir = makeTempDir();
    try {
      const filePath = path.join(dir, "stereo.wav");
      writeWavFile(filePath, Buffer.alloc(100), { channels: 2 });
      const buf = fs.readFileSync(filePath);
      expect(buf.readUInt16LE(22)).toBe(2);
    } finally {
      removeTempDir(dir);
    }
  });
});

describe("wav — rmsLevel", () => {
  it("retorna 0 para buffer vazio", () => {
    expect(rmsLevel(Buffer.alloc(0))).toBe(0);
    expect(rmsLevel(null)).toBe(0);
  });

  it("retorna 0 para silencio", () => {
    expect(rmsLevel(Buffer.alloc(100))).toBe(0);
  });

  it("retorna valor > 0 para sinal", () => {
    const buf = Buffer.alloc(200);
    for (let i = 0; i < 100; i++) buf.writeInt16LE(16000, i * 2);
    const level = rmsLevel(buf);
    expect(level).toBeGreaterThan(0.4);
  });

  it("sinal mais alto retorna RMS maior", () => {
    const low = Buffer.alloc(100);
    const high = Buffer.alloc(100);
    for (let i = 0; i < 50; i++) {
      low.writeInt16LE(1000, i * 2);
      high.writeInt16LE(30000, i * 2);
    }
    expect(rmsLevel(high)).toBeGreaterThan(rmsLevel(low));
  });
});
