import { describe, expect, it } from 'vitest';
import { DEFAULT_PROMPT, resolveOptions } from '../options';
import {
  actionValues,
  buildPrompt,
  buildProviderUrl,
  citation,
  shareUrl,
  toHtml,
  toMarkdown,
  toPlainText,
  truncate,
  type SelectionSnapshot,
} from './formats';

const snapshot: SelectionSnapshot = {
  text: 'He manages nine writers.\n\nThey work on <docs> & more.',
  before: 'Sean Huck at Adyen approaches the problem from the organizational side.',
  after: 'One of our big goals is to be included.',
  title: 'Docs as product',
  sections: ['Buy-in', 'Organizational [side]'],
  link: 'https://site.dev/docs/x#organizational-side:~:text=He%20manages',
};

describe('citation', () => {
  it('joins the title and sections', () => {
    expect(citation(snapshot)).toBe('Docs as product › Buy-in › Organizational [side]');
  });
});

describe('toPlainText', () => {
  it('quotes each paragraph and ends with the citation and link', () => {
    expect(toPlainText(snapshot)).toBe(
      [
        '> He manages nine writers.',
        '>',
        '> They work on <docs> & more.',
        '',
        '— Docs as product › Buy-in › Organizational [side]',
        snapshot.link,
      ].join('\n')
    );
  });
});

describe('toHtml', () => {
  it('escapes content and links the citation', () => {
    expect(toHtml(snapshot)).toBe(
      '<blockquote>He manages nine writers.<br><br>They work on &lt;docs&gt; &amp; more.</blockquote>' +
        `<p>— <a href="${snapshot.link}">Docs as product › Buy-in › Organizational [side]</a></p>`
    );
  });
});

describe('toMarkdown', () => {
  it('escapes brackets in the link text', () => {
    expect(toMarkdown(snapshot)).toContain(
      `— [Docs as product › Buy-in › Organizational \\[side\\]](${snapshot.link})`
    );
  });
});

describe('truncate', () => {
  it('cuts at a word boundary and adds an ellipsis', () => {
    expect(truncate('one two three four five', 12)).toBe('one two…');
  });

  it('leaves short text alone', () => {
    expect(truncate('short', 12)).toBe('short');
  });
});

describe('share URLs', () => {
  it('builds an X intent with a quoted, shortened passage', () => {
    const url = shareUrl('x', snapshot)!;
    expect(url.startsWith('https://x.com/intent/post?text=%E2%80%9C')).toBe(true);
    expect(url).toContain(`&url=${encodeURIComponent(snapshot.link)}`);
  });

  it('has no URL for clipboard actions', () => {
    expect(shareUrl('copy', snapshot)).toBeUndefined();
  });

  it('exposes Markdown as {quote} for custom actions', () => {
    expect(actionValues(snapshot).quote).toBe(toMarkdown(snapshot));
  });
});

describe('buildPrompt', () => {
  it('includes the passage, section, link and marked context', () => {
    const prompt = buildPrompt(snapshot, DEFAULT_PROMPT, 600);
    expect(prompt).toContain('I\'m reading "Docs as product"');
    expect(prompt).toContain('Section: Buy-in › Organizational [side]');
    expect(prompt).toContain(`Page: ${snapshot.link}`);
    expect(prompt).toContain('He manages nine writers.\n\nThey work on <docs> & more.');
    expect(prompt).toContain('organizational side. [[PASSAGE]] One of our big goals');
  });

  it('omits the Markdown line when the page has no Markdown export', () => {
    expect(buildPrompt(snapshot, DEFAULT_PROMPT, 600)).not.toContain('Full page as Markdown');
    expect(
      buildPrompt(
        { ...snapshot, markdownUrl: 'https://site.dev/docs/x/index.md' },
        DEFAULT_PROMPT,
        600
      )
    ).toContain('Full page as Markdown: https://site.dev/docs/x/index.md');
  });

  it('trims context to the requested length from the inside out', () => {
    const prompt = buildPrompt(snapshot, '{context}', 20);
    expect(prompt).toBe('…organizational side. [[PASSAGE]] One of our big goals…');
  });
});

describe('buildProviderUrl', () => {
  const ai = resolveOptions().ai;
  const provider = { label: 'Claude', url: 'https://claude.ai/new?q={prompt}' };

  it('encodes the prompt into the provider URL', () => {
    const url = buildProviderUrl(provider, snapshot, ai, 600);
    expect(url.startsWith('https://claude.ai/new?q=')).toBe(true);
    expect(decodeURIComponent(url.split('q=')[1])).toBe(buildPrompt(snapshot, ai.prompt, 600));
  });

  it('sheds context, then passage length, to fit the URL limit', () => {
    const long = { ...snapshot, text: 'word '.repeat(2000), before: 'x '.repeat(400) };
    const url = buildProviderUrl(provider, long, { ...ai, maxUrlLength: 6000 }, 600);
    expect(url.length).toBeLessThanOrEqual(6000);
    expect(decodeURIComponent(url)).not.toContain('[[PASSAGE]]');
  });
});
