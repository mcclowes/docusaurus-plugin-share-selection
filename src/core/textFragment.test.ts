import { describe, expect, it } from 'vitest';
import { buildDeepLink, buildTextDirective, encodeFragmentTerm } from './textFragment';

describe('encodeFragmentTerm', () => {
  it('encodes the characters the text directive syntax reserves', () => {
    expect(encodeFragmentTerm('a-b, c & d')).toBe('a%2Db%2C%20c%20%26%20d');
  });
});

describe('buildTextDirective', () => {
  it('matches short passages exactly', () => {
    expect(buildTextDirective({ text: 'the organizational side' })).toBe(
      'text=the%20organizational%20side'
    );
  });

  it('uses start and end terms for long passages', () => {
    const text =
      'Sean Huck at Adyen approaches the same problem from the organizational side and manages nine writers.';
    expect(buildTextDirective({ text })).toBe(
      'text=Sean%20Huck%20at%20Adyen,and%20manages%20nine%20writers.'
    );
  });

  it('collapses whitespace and strips zero-width characters', () => {
    expect(buildTextDirective({ text: '  one\u200B\n two   three ' })).toBe(
      'text=one%20two%20three'
    );
  });

  it('drops words the selection cut in half', () => {
    expect(
      buildTextDirective({
        text: 'ganization side matters to eve',
        before: 'the or',
        after: 'ryone',
      })
    ).toBe('text=side%20matters%20to');
  });

  it('keeps edge words when the selection starts and ends on word boundaries', () => {
    expect(buildTextDirective({ text: 'side matters here', before: 'the ', after: '.' })).toBe(
      'text=side%20matters%20here'
    );
  });

  it('returns nothing when no whole word is selected', () => {
    expect(buildTextDirective({ text: 'ani', before: 'org', after: 'zation' })).toBe('');
  });

  it('adds a prefix and suffix when the passage appears more than once on the page', () => {
    const pageText = 'Install the plugin first. Later, configure the plugin first. Done.';
    expect(
      buildTextDirective({
        text: 'the plugin first',
        before: 'Later, configure ',
        after: '. Done.',
        pageText,
      })
    ).toBe('text=Later%2C%20configure-,the%20plugin%20first,-.%20Done.');
  });

  it('leaves unique passages without context terms', () => {
    expect(
      buildTextDirective({
        text: 'configure the plugin',
        before: 'Later, ',
        after: ' first.',
        pageText: 'Install it. Later, configure the plugin first.',
      })
    ).toBe('text=configure%20the%20plugin');
  });
});

describe('buildDeepLink', () => {
  it('combines the heading anchor with the text directive', () => {
    expect(buildDeepLink('https://site.dev/docs/a#old', 'set-up', 'text=hello')).toBe(
      'https://site.dev/docs/a#set-up:~:text=hello'
    );
  });

  it('falls back to the heading anchor alone', () => {
    expect(buildDeepLink('https://site.dev/docs/a', 'set-up')).toBe(
      'https://site.dev/docs/a#set-up'
    );
  });

  it('uses a bare directive when there is no heading', () => {
    expect(buildDeepLink('https://site.dev/docs/a', undefined, 'text=hello')).toBe(
      'https://site.dev/docs/a#:~:text=hello'
    );
  });

  it('returns the page URL when there is nothing to add', () => {
    expect(buildDeepLink('https://site.dev/docs/a')).toBe('https://site.dev/docs/a');
  });
});
