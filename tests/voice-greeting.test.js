import { describe, it, expect } from '@jest/globals';
import { timeBasedGreeting, buildGreeting } from '../src/voice/greeting.js';

describe('greeting - timeBasedGreeting', () => {
  it('Bom dia entre 5h e 12h', () => {
    expect(timeBasedGreeting(new Date(2026, 0, 1, 5))).toBe('Bom dia');
    expect(timeBasedGreeting(new Date(2026, 0, 1, 8))).toBe('Bom dia');
    expect(timeBasedGreeting(new Date(2026, 0, 1, 11))).toBe('Bom dia');
  });

  it('Boa tarde entre 12h e 18h', () => {
    expect(timeBasedGreeting(new Date(2026, 0, 1, 12))).toBe('Boa tarde');
    expect(timeBasedGreeting(new Date(2026, 0, 1, 15))).toBe('Boa tarde');
    expect(timeBasedGreeting(new Date(2026, 0, 1, 17))).toBe('Boa tarde');
  });

  it('Boa noite entre 18h e 5h', () => {
    expect(timeBasedGreeting(new Date(2026, 0, 1, 18))).toBe('Boa noite');
    expect(timeBasedGreeting(new Date(2026, 0, 1, 22))).toBe('Boa noite');
    expect(timeBasedGreeting(new Date(2026, 0, 1, 2))).toBe('Boa noite');
    expect(timeBasedGreeting(new Date(2026, 0, 1, 4))).toBe('Boa noite');
  });
});

describe('greeting - buildGreeting', () => {
  it('usa custom se passado', () => {
    expect(buildGreeting({ custom: 'Oi' })).toBe('Oi');
  });

  it('junta com nome', () => {
    const r = buildGreeting({ name: 'Yuri' });
    expect(r).toMatch(/Yuri/);
    expect(r).toMatch(/Bom dia|Boa tarde|Boa noite/);
  });

  it('sem nome', () => {
    const r = buildGreeting();
    expect(r).toMatch(/Bom dia|Boa tarde|Boa noite/);
    expect(r).not.toMatch(/,/);
  });
});
