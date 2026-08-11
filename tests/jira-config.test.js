import { getJiraAuthHeader, getJiraBaseUrl, getJiraConfig } from '../src/config/jira.js';

describe('jira config', () => {
  it('monta base URL https', () => {
    expect(getJiraBaseUrl()).toBe('https://example.atlassian.net');
  });

  it('monta Basic auth header', () => {
    const header = getJiraAuthHeader();
    expect(header.startsWith('Basic ')).toBe(true);
    const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf-8');
    expect(decoded).toBe('dev@example.com:jira-test-token');
  });

  it('getJiraConfig retorna domínio/email/token', () => {
    const cfg = getJiraConfig();
    expect(cfg.domain).toBe('example.atlassian.net');
    expect(cfg.email).toBe('dev@example.com');
    expect(cfg.token).toBe('jira-test-token');
  });
});
