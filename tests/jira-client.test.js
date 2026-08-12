import { jest } from '@jest/globals';

describe('jira client', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('listIssues chama endpoint JQL correto', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ issues: [{ key: 'SDG-1' }] }),
    }));
    global.fetch = fetchMock;

    const { listIssues } = await import('../src/jira/client.js');
    const data = await listIssues('SDG', 'project=SDG ORDER BY updated DESC');

    expect(data.issues[0].key).toBe('SDG-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0];
    expect(url).toContain('https://example.atlassian.net/rest/api/3/search/jql?jql=');
    expect(url).toContain(encodeURIComponent('project=SDG'));
  });

  it('lança erro quando API falha', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));

    const { getIssue } = await import('../src/jira/client.js');
    await expect(getIssue('SDG-1')).rejects.toThrow(/Jira API: 401/);
  });
});
