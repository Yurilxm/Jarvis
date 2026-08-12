import { jest } from '@jest/globals';

describe('jira client — createIssue', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('monta payload com ADF e assignee', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ key: 'SDG-99', id: '1' }),
    }));
    global.fetch = fetchMock;

    const { createIssue } = await import('../src/jira/client.js');
    const result = await createIssue('10033', 'Título', 'Descrição', '10001', 'acc-1');

    expect(result.key).toBe('SDG-99');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.atlassian.net/rest/api/3/issue');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.fields.project.id).toBe('10033');
    expect(body.fields.summary).toBe('Título');
    expect(body.fields.issuetype.id).toBe('10001');
    expect(body.fields.assignee.id).toBe('acc-1');
    expect(body.fields.description.type).toBe('doc');
    expect(body.fields.description.content[0].content[0].text).toBe('Descrição');
  });

  it('transitionIssue aceita 204', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 204,
      text: async () => '',
    }));

    const { transitionIssue } = await import('../src/jira/client.js');
    await expect(transitionIssue('SDG-1', '21')).resolves.toBeUndefined();
  });
});
