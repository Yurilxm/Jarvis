import { buildSignature } from '../src/commit/signature.js';

describe('buildSignature', () => {
  it('deve retornar null se o perfil for null', () => {
    expect(buildSignature(null)).toBeNull();
  });

  it('deve retornar null se a assinatura estiver desativada', () => {
    const profile = { signatureEnabled: false, name: 'Yuri', githubUsername: 'Yurilxm' };
    expect(buildSignature(profile)).toBeNull();
  });

  it('deve retornar a assinatura completa quando nome e github estão presentes', () => {
    const profile = { signatureEnabled: true, name: 'Yuri', githubUsername: 'Yurilxm' };
    expect(buildSignature(profile)).toBe('Assinado por: Yuri (@Yurilxm)');
  });

  it('deve retornar apenas o nome se github não estiver presente', () => {
    const profile = { signatureEnabled: true, name: 'Yuri' };
    expect(buildSignature(profile)).toBe('Assinado por: Yuri');
  });

  it('deve retornar apenas o @username se nome não estiver presente', () => {
    const profile = { signatureEnabled: true, githubUsername: 'Yurilxm' };
    expect(buildSignature(profile)).toBe('Assinado por: @Yurilxm');
  });

  it('deve retornar null se ambos nome e github estiverem vazios', () => {
    const profile = { signatureEnabled: true };
    expect(buildSignature(profile)).toBeNull();
  });
});