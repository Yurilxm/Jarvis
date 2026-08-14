import { jest } from '@jest/globals';

describe('jira client â€” update/delete', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('updateIssue monta payload correto e faz PUT', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 204,
      json: async () => ({}),
    }));
    global.fetch = fetchMock;

    const { updateIssue } = await import('../src/jira/client.js');
    await updateIssue('SDG-1', {
      summary: 'Novo tÃ­tulo',
      description: 'Nova descriÃ§Ã£o',
      assigneeId: 'acc-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.atlassian.net/rest/api/3/issue/SDG-1');
    expect(options.method).toBe('PUT');
    const body = JSON.parse(options.body);
    expect(body.fields.summary).toBe('Novo tÃ­tulo');
    expect(body.fields.description.type).toBe('doc');
    expect(body.fields.assignee.id).toBe('acc-1');
  });

  it('updateIssue lida com campos vazios', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 204,
    }));
    global.fetch = fetchMock;

    const { updateIssue } = await import('../src/jira/client.js');
    await updateIssue('SDG-1', { summary: 'SÃ³ tÃ­tulo' });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.fields.summary).toBe('SÃ³ tÃ­tulo');
    expect(body.fields.description).toBeUndefined();
    expect(body.fields.assignee).toBeUndefined();
  });

  it('deleteIssue faz DELETE e aceita 204', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 204,
    }));
    global.fetch = fetchMock;

    const { deleteIssue } = await import('../src/jira/client.js');
    await expect(deleteIssue('SDG-1')).resolves.toBeUndefined();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.atlassian.net/rest/api/3/issue/SDG-1');
    expect(options.method).toBe('DELETE');
  });

  it('lanÃ§a erro quando API falha no update', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    }));

    const { updateIssue } = await import('../src/jira/client.js');
    await expect(updateIssue('SDG-1', {})).rejects.toThrow(/Jira API: 400/);
  });
});