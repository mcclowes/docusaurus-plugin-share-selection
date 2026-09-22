import { describe, expect, it } from 'vitest';
import { renderTemplate, renderUrlTemplate } from './template';

describe('renderTemplate', () => {
  it('fills placeholders', () => {
    expect(renderTemplate('Read {title} at {url}', { title: 'Guide', url: 'https://x.dev' })).toBe(
      'Read Guide at https://x.dev'
    );
  });

  it('drops lines whose placeholders are all empty', () => {
    expect(
      renderTemplate('Title: {title}\nMarkdown: {markdownUrl}\nEnd', {
        title: 'Guide',
        markdownUrl: '',
      })
    ).toBe('Title: Guide\nEnd');
  });

  it('keeps lines where at least one placeholder has a value', () => {
    expect(renderTemplate('Pair: {a} and {b}', { a: '', b: 'B' })).toBe('Pair:  and B');
  });

  it('leaves unknown placeholders alone', () => {
    expect(renderTemplate('{unknown} {title}', { title: 'T' })).toBe('{unknown} T');
  });

  it('collapses the blank lines dropped lines leave behind', () => {
    expect(renderTemplate('A\n\n{gone}\n\nB', { gone: '' })).toBe('A\n\nB');
  });
});

describe('renderUrlTemplate', () => {
  it('encodes every value', () => {
    expect(
      renderUrlTemplate('https://x.com/intent/post?text={text}&url={url}', {
        text: 'a & b',
        url: 'https://s.dev/#:~:text=a',
      })
    ).toBe(
      'https://x.com/intent/post?text=a%20%26%20b&url=https%3A%2F%2Fs.dev%2F%23%3A~%3Atext%3Da'
    );
  });
});
