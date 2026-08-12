import { buildWarning } from '../src/ai/usage-tracker.js';

describe('buildWarning (cota Gemini)', () => {
  it('retorna null abaixo do threshold', () => {
    expect(buildWarning(0)).toBeNull();
    expect(buildWarning(5)).toBeNull();
  });

  it('avisa no threshold', () => {
    const msg = buildWarning(15);
    expect(msg).toMatch(/Atenção/);
    expect(msg).toMatch(/15\/20/);
  });

  it('bloqueia na cota diária', () => {
    const msg = buildWarning(20);
    expect(msg).toMatch(/Cota diária/);
    expect(msg).toMatch(/20\/20/);
  });
});
