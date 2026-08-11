/**
 * Aliases curtos da CLI e resolução de comando.
 */
export const ALIASES = {
  c: 'commit',
  s: 'status',
  m: 'merge',
  b: 'branch',
  p: 'pull',
  u: 'update',
  r: 'review',
  d: 'docs',
  h: 'history',
  i: 'init',
  j: 'jira',
  t: 'today',
  a: 'analyze',
  w: 'projects',
};

/**
 * Resolve alias curto para o comando canônico.
 * @param {string|undefined} raw
 * @returns {string|undefined}
 */
export function resolveCommand(raw) {
  if (!raw) return raw;
  return ALIASES[raw] || raw;
}
