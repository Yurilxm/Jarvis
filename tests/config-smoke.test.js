import { buildSignature } from '../src/commit/signature.js';
import { getProtectedBranch, getDevelopmentBranch } from '../src/config/branches.js';
import { getGitHubToken } from '../src/config/github.js';

describe('branches defaults', () => {
  it('usa main/dev por padrão', () => {
    expect(getProtectedBranch()).toBe('main');
    expect(getDevelopmentBranch()).toBe('dev');
  });
});

describe('github token config', () => {
  it('lê GITHUB_TOKEN do ambiente de teste', () => {
    expect(getGitHubToken()).toContain('test_token');
  });
});

describe('buildSignature — integração leve', () => {
  it('combina perfil completo', () => {
    expect(
      buildSignature({
        signatureEnabled: true,
        name: 'Kayo',
        githubUsername: 'kayomacedo',
      })
    ).toBe('Assinado por: Kayo (@kayomacedo)');
  });
});
