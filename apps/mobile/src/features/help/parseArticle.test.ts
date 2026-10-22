import { parseArticleContent } from './parseArticle';

describe('parseArticleContent', () => {
  it('reads headings at three levels', () => {
    expect(parseArticleContent('# One\n## Two\n### Three')).toEqual([
      { type: 'heading', level: 1, text: 'One' },
      { type: 'heading', level: 2, text: 'Two' },
      { type: 'heading', level: 3, text: 'Three' },
    ]);
  });

  it('groups consecutive bullet lines into one list, with either marker', () => {
    expect(parseArticleContent('- a\n* b\n- c')).toEqual([{ type: 'bullets', items: ['a', 'b', 'c'] }]);
  });

  it('ends a list at a blank line or any other block', () => {
    expect(parseArticleContent('- a\n\n- b\nplain')).toEqual([
      { type: 'bullets', items: ['a'] },
      { type: 'bullets', items: ['b'] },
      { type: 'paragraph', text: 'plain' },
    ]);
  });

  it('keeps numbered lines as their own lines, text included', () => {
    expect(parseArticleContent('1. First\n2. Second')).toEqual([
      { type: 'numbered', text: '1. First' },
      { type: 'numbered', text: '2. Second' },
    ]);
  });

  it('treats everything else as paragraphs and skips blank lines', () => {
    expect(parseArticleContent('Hello there\r\n\r\nSecond paragraph')).toEqual([
      { type: 'paragraph', text: 'Hello there' },
      { type: 'paragraph', text: 'Second paragraph' },
    ]);
  });

  it('returns nothing for empty content', () => {
    expect(parseArticleContent('')).toEqual([]);
  });
});
