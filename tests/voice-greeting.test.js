import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  timePeriod,
  timeBasedGreeting,
  buildGreeting,
  GREETING_VARIATIONS,
  _resetGreetingState,
} from '../src/voice/greeting.js';

beforeEach(() => _resetGreetingState());

describe('greeting - timePeriod', () => {
  it('morning entre 5h e 12h', () => {
    expect(timePeriod(new Date(2026, 0, 1, 5))).toBe('morning');
    expect(timePeriod(new Date(2026, 0, 1, 11))).toBe('morning');
  });
  it('afternoon entre 12h e 18h', () => {
    expect(timePeriod(new Date(2026, 0, 1, 12))).toBe('afternoon');
    expect(timePeriod(new Date(2026, 0, 1, 17))).toBe('afternoon');
  });
  it('night entre 18h e 5h', () => {
    expect(timePeriod(new Date(2026, 0, 1, 18))).toBe('night');
    expect(timePeriod(new Date(2026, 0, 1, 2))).toBe('night');
  });
});

describe('greeting - timeBasedGreeting (compat)', () => {
  it('manha/tarde/noite', () => {
    expect(timeBasedGreeting(new Date(2026, 0, 1, 8))).toBe('Bom dia');
    expect(timeBasedGreeting(new Date(2026, 0, 1, 15))).toBe('Boa tarde');
    expect(timeBasedGreeting(new Date(2026, 0, 1, 22))).toBe('Boa noite');
  });
});

describe('greeting - buildGreeting com nome', () => {
  it('inclui o nome', () => {
    for (let i = 0; i < 10; i++) {
      const r = buildGreeting({ name: 'Yuri', date: new Date(2026, 0, 1, 8) });
      expect(r).toMatch(/Yuri/);
    }
  });

  it('nao inclui "chefe"', () => {
    for (let i = 0; i < 10; i++) {
      const r = buildGreeting({ name: 'Yuri', date: new Date(2026, 0, 1, 8) });
      expect(r.toLowerCase()).not.toMatch(/chefe/);
    }
  });

  it('respeita custom', () => {
    expect(buildGreeting({ custom: 'Oi' })).toBe('Oi');
    expect(buildGreeting({ custom: 'Tudo certo', name: 'Yuri' })).toBe('Tudo certo');
  });

  it('nunca repete o mesmo indice duas vezes seguidas', () => {
    const seen = new Set();
    let last = null;
    let repeats = 0;
    for (let i = 0; i < 30; i++) {
      const r = buildGreeting({ name: 'Yuri', date: new Date(2026, 0, 1, 8) });
      if (r === last) repeats++;
      last = r;
      seen.add(r);
    }
    // Pode repetir apos 2+ variacoes, mas nunca imediatamente.
    // Se a lista tem 5 itens, ver 5 variações diferentes em 30 chamadas.
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expect(repeats).toBe(0);
  });
});

describe('greeting - buildGreeting sem nome', () => {
  it('nao deixa virgula sobrando', () => {
    for (let i = 0; i < 10; i++) {
      const r = buildGreeting({ date: new Date(2026, 0, 1, 8) });
      expect(r).not.toMatch(/,\\s*\\./);
      expect(r).not.toMatch(/\\{name\\}/);
    }
  });
});

describe('greeting - GREETING_VARIATIONS', () => {
  it('tem 3 periodos, cada um com >= 4 variacoes', () => {
    expect(Object.keys(GREETING_VARIATIONS)).toEqual(
      expect.arrayContaining(['morning', 'afternoon', 'night'])
    );
    for (const k of ['morning', 'afternoon', 'night']) {
      expect(GREETING_VARIATIONS[k].length).toBeGreaterThanOrEqual(4);
    }
  });
});
