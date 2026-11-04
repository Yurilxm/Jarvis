import { describe, it, expect } from '@jest/globals';
import { parseVoicePauseDuration } from '../src/voice/state.js';
import { matchIntent } from '../src/voice/intentMatcher.js';

describe('pause - parseVoicePauseDuration', () => {
  it('sem duracao -> null', () => {
    expect(parseVoicePauseDuration('pausa')).toBeNull();
    expect(parseVoicePauseDuration('Jarvis, pausa')).toBeNull();
    expect(parseVoicePauseDuration('cala a boca')).toBeNull();
  });

  it('30 minutos (numerico)', () => {
    expect(parseVoicePauseDuration('pausa por 30 minutos')).toBe(30 * 60 * 1000);
    expect(parseVoicePauseDuration('pausa por 30min')).toBe(30 * 60 * 1000);
    expect(parseVoicePauseDuration('pausa por 30m')).toBe(30 * 60 * 1000);
  });

  it('2 horas (numerico)', () => {
    expect(parseVoicePauseDuration('pausa por 2 horas')).toBe(2 * 60 * 60 * 1000);
    expect(parseVoicePauseDuration('pausa por 2h')).toBe(2 * 60 * 60 * 1000);
    expect(parseVoicePauseDuration('pausa por 12 horas')).toBe(12 * 60 * 60 * 1000);
  });

  it('uma hora', () => {
    expect(parseVoicePauseDuration('pausa por uma hora')).toBe(60 * 60 * 1000);
  });

  it('uma hora e meia', () => {
    expect(parseVoicePauseDuration('pausa por uma hora e meia')).toBe(90 * 60 * 1000);
  });

  it('meia hora', () => {
    expect(parseVoicePauseDuration('pausa por meia hora')).toBe(30 * 60 * 1000);
  });

  it('cinco minutos (palavra)', () => {
    expect(parseVoicePauseDuration('pausa por cinco minutos')).toBe(5 * 60 * 1000);
  });
});

describe('pause - intent matching', () => {
  it('"pausa" casa com pause', () => {
    const r = matchIntent('pausa');
    expect(r.intent).toBe('pause');
  });

  it('"pausa por 30 minutos" casa com pause', () => {
    const r = matchIntent('pausa por 30 minutos');
    expect(r.intent).toBe('pause');
  });

  it('"quieto" casa com pause', () => {
    const r = matchIntent('quieto');
    expect(r.intent).toBe('pause');
  });

  it('"silencio" casa com pause', () => {
    const r = matchIntent('silencio');
    expect(r.intent).toBe('pause');
  });

  it('"cala a boca" casa com pause', () => {
    const r = matchIntent('cala a boca');
    expect(r.intent).toBe('pause');
  });

  it('"para" casa com cancel', () => {
    expect(matchIntent('para').intent).toBe('cancel');
  });

  it('"chega" casa com cancel', () => {
    expect(matchIntent('chega').intent).toBe('cancel');
  });
});
