import { semverBump } from '../src/commands/release.js';

describe('semverBump', () => {
  it('deve incrementar o patch', () => {
    expect(semverBump('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('deve incrementar o minor e zerar o patch', () => {
    expect(semverBump('1.2.3', 'minor')).toBe('1.3.0');
  });

  it('deve incrementar o major e zerar minor e patch', () => {
    expect(semverBump('1.2.3', 'major')).toBe('2.0.0');
  });

  it('deve lidar com versão sem patch', () => {
    expect(semverBump('1.0', 'patch')).toBe('1.0.1');
  });
});