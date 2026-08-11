/**
 * Parse do separador ---BODY--- usado no fluxo de commit.
 * Espelha a lógica de src/commit/flow.js para garantir regressão.
 */
function parseCommitMessage(message) {
  const bodySeparator = '---BODY---';
  let title = message;
  let body = '';

  if (message.includes(bodySeparator)) {
    const parts = message.split(bodySeparator);
    title = parts[0].trim();
    body = parts.slice(1).join(bodySeparator).trim();
  }

  return { title, body };
}

describe('parseCommitMessage', () => {
  it('separa título e corpo', () => {
    const { title, body } = parseCommitMessage(
      'feat: adiciona menu\n---BODY---\n- item 1\n- item 2'
    );
    expect(title).toBe('feat: adiciona menu');
    expect(body).toContain('- item 1');
  });

  it('sem separador usa mensagem inteira como título', () => {
    const { title, body } = parseCommitMessage('chore: bump');
    expect(title).toBe('chore: bump');
    expect(body).toBe('');
  });

  it('mantém ---BODY--- extras no corpo', () => {
    const { title, body } = parseCommitMessage('fix: x\n---BODY---\na\n---BODY---\nb');
    expect(title).toBe('fix: x');
    expect(body).toContain('---BODY---');
  });
});
