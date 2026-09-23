import { parseDuration, formatDuration } from '../src/report/duration.js';

describe('report — parseDuration', () => {
  it('interpreta horas', () => {
    expect(parseDuration('1h')).toBe(3600 * 1000);
    expect(parseDuration('24h')).toBe(24 * 3600 * 1000);
  });

  it('interpreta dias', () => {
    expect(parseDuration('7d')).toBe(7 * 24 * 3600 * 1000);
    expect(parseDuration('1d')).toBe(24 * 3600 * 1000);
  });

  it('interpreta semanas', () => {
    expect(parseDuration('2w')).toBe(2 * 7 * 24 * 3600 * 1000);
  });

  it('interpreta meses', () => {
    expect(parseDuration('1m')).toBe(30 * 24 * 3600 * 1000);
  });

  it('interpreta anos', () => {
    expect(parseDuration('1y')).toBe(365 * 24 * 3600 * 1000);
  });

  it('aceita maiúsculas', () => {
    expect(parseDuration('7D')).toBe(7 * 24 * 3600 * 1000);
  });

  it('rejeita formato inválido', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('7')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration(null)).toBeNull();
    expect(parseDuration('0d')).toBeNull();
    expect(parseDuration('-1d')).toBeNull();
  });
});

describe('report — formatDuration', () => {
  it('formata dias', () => {
    expect(formatDuration(7 * 24 * 3600 * 1000)).toBe('7 dias');
    expect(formatDuration(1 * 24 * 3600 * 1000)).toBe('1 dia');
  });

  it('formata horas', () => {
    expect(formatDuration(2 * 3600 * 1000)).toBe('2 horas');
    expect(formatDuration(1 * 3600 * 1000)).toBe('1 hora');
  });

  it('formata minutos para períodos curtos', () => {
    expect(formatDuration(30 * 60 * 1000)).toBe('30 minutos');
  });
});