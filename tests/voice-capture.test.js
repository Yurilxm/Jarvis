import { buildRecorderArgs, getTempWavPath } from '../src/voice/audioCapture.js';
import { parseWhisperOutput } from '../src/voice/whisper.js';
import { normalize } from '../src/voice/intentMatcher.js';

describe('voice — buildRecorderArgs', () => {
  it('ffmpeg no Windows usa dshow com o dispositivo informado', () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const args = buildRecorderArgs({
        type: 'ffmpeg',
        audioDevice: 'Microphone (Realtek)',
        outputPath: 'out.wav',
      });
      expect(args).toContain('dshow');
      expect(args.join(' ')).toContain('audio=Microphone (Realtek)');
      expect(args[args.length - 1]).toBe('out.wav');
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  });

  it('ffmpeg no Windows lança erro quando dispositivo não é informado', () => {
    const original = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      expect(() =>
        buildRecorderArgs({
          type: 'ffmpeg',
          audioDevice: null,
          outputPath: 'out.wav',
        })
      ).toThrow(/Nenhum microfone configurado/);
    } finally {
      Object.defineProperty(process, 'platform', { value: original });
    }
  });

  it('sox usa args simples', () => {
    const args = buildRecorderArgs({
      type: 'sox',
      audioDevice: null,
      outputPath: 'out.wav',
    });
    expect(args[0]).toBe('-d');
    expect(args).toContain('16000');
    expect(args[args.length - 1]).toBe('out.wav');
  });

  it('lança erro para tipo desconhecido', () => {
    expect(() =>
      buildRecorderArgs({ type: 'xyz', audioDevice: null, outputPath: 'out.wav' })
    ).toThrow(/Gravador desconhecido/);
  });
});

describe('voice — getTempWavPath', () => {
  it('retorna caminho em pasta temporária com .wav', () => {
    const p = getTempWavPath();
    expect(p.endsWith('.wav')).toBe(true);
    expect(p).toContain('jarvis-voz');
  });

  it('gera nomes diferentes em chamadas seguidas', async () => {
    const p1 = getTempWavPath();
    await new Promise((r) => setTimeout(r, 5));
    const p2 = getTempWavPath();
    expect(p1).not.toBe(p2);
  });
});

describe('voice — parseWhisperOutput', () => {
  it('remove timestamps', () => {
    const raw = '[00:00:00.000 --> 00:00:03.000]  lista do jira\n';
    expect(parseWhisperOutput(raw)).toBe('lista do jira');
  });

  it('junta múltiplas linhas em uma frase', () => {
    const raw = [
      '[00:00:00.000 --> 00:00:02.000]  o que eu',
      '[00:00:02.000 --> 00:00:04.000]  tenho hoje',
    ].join('\n');
    expect(parseWhisperOutput(raw)).toBe('o que eu tenho hoje');
  });

  it('remove ruídos comuns', () => {
    const raw = '[BLANK_AUDIO]\nlista do jira\n(música)\n';
    expect(parseWhisperOutput(raw)).toBe('lista do jira');
  });

  it('lida com saída sem timestamp', () => {
    const raw = 'lista do jira\n';
    expect(parseWhisperOutput(raw)).toBe('lista do jira');
  });

  it('retorna string vazia para entrada vazia', () => {
    expect(parseWhisperOutput('')).toBe('');
    expect(parseWhisperOutput(null)).toBe('');
    expect(parseWhisperOutput(undefined)).toBe('');
  });
});

describe('voice — pipeline end-to-end (simulado)', () => {
  it('texto transcrito é reconhecido pelo intent matcher', () => {
    const raw = '[00:00:00.000 --> 00:00:03.000]  lista do jira\n';
    const text = parseWhisperOutput(raw);
    const normalized = normalize(text);
    expect(normalized).toBe('lista do jira');
  });
});