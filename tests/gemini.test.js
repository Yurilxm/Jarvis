import { jest } from '@jest/globals';

describe('gemini client', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.unstable_mockModule('../src/ai/usage-tracker.js', () => ({
      checkUsage: jest.fn(async () => ({ warning: null })),
      incrementUsage: jest.fn(async () => ({ warning: null })),
      buildWarning: jest.fn(() => null),
    }));
    jest.unstable_mockModule('../src/ui.js', () => ({
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      dim: jest.fn(),
      blank: jest.fn(),
      printBanner: jest.fn(),
      printBox: jest.fn(),
      chalk: { green: (s) => s, red: (s) => s, yellow: (s) => s, dim: (s) => s, bold: (s) => s, cyan: (s) => s },
      muted: (s) => s,
    }));
  });

  it('generateWithGemini extrai texto da resposta', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'feat: teste\n---BODY---\n- ok' }] } }],
      }),
    }));

    const { generateWithGemini } = await import('../src/ai/gemini.js');
    const text = await generateWithGemini('prompt');
    expect(text).toContain('feat: teste');
    expect(global.fetch).toHaveBeenCalled();
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('generateContent');
    expect(url).toContain('key=');
  });

  it('falha quando response não ok', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'boom',
    }));

    const { generateWithGemini } = await import('../src/ai/gemini.js');
    await expect(generateWithGemini('x')).rejects.toThrow(/Erro na API Gemini/);
  });

  it('falha quando não há texto nos candidates', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ candidates: [{}] }),
    }));

    const { generateWithGemini } = await import('../src/ai/gemini.js');
    await expect(generateWithGemini('x')).rejects.toThrow(/não contém texto válido/);
  });
});
