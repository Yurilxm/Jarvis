import { filterInternalPaths, shouldSuggestJarvisRelease } from '../src/commit/helpers.js';

describe('filterInternalPaths', () => {
  it('remove .jarvis/ e subarquivos', () => {
    const files = ['src/cli.js', '.jarvis/history.jsonl', '.jarvis/next-cwd', 'README.md'];
    expect(filterInternalPaths(files)).toEqual(['src/cli.js', 'README.md']);
  });

  it('mantém arquivos normais', () => {
    expect(filterInternalPaths(['a.js', 'b.py'])).toEqual(['a.js', 'b.py']);
  });
});

describe('shouldSuggestJarvisRelease', () => {
  it('sugere release no repo do Jarvis com feat/fix', () => {
    expect(shouldSuggestJarvisRelease('https://github.com/Yurilxm/Jarvis.git', 'feat')).toBe(true);
    expect(shouldSuggestJarvisRelease('git@github.com:kayomacedo/Jarvis.git', 'fix')).toBe(true);
  });

  it('não sugere release em outros repos', () => {
    expect(shouldSuggestJarvisRelease('https://github.com/empresa/frontend-stack.git', 'feat')).toBe(false);
  });

  it('não sugere release para chore/docs no repo do Jarvis', () => {
    expect(shouldSuggestJarvisRelease('https://github.com/Yurilxm/Jarvis.git', 'chore')).toBe(false);
  });
});