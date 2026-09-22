import { beforeEach, describe, expect, it } from 'vitest';
import {
  captureSelection,
  eligibleRoot,
  enclosingSections,
  markdownUrlFor,
  rangeText,
  type CaptureOptions,
} from './capture';

const options: CaptureOptions = {
  contentSelector: '.markdown',
  excludeSelector: 'pre, code, .hash-link, button',
  minWords: 3,
  contextChars: 600,
  textFragments: true,
  markdownFile: 'index.md',
};

const location = new URL('https://site.dev/docs/guide?v=2#old') as unknown as Location;

function selectText(node: Node, start: number, endNode: Node, end: number): Selection {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(endNode, end);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

function textNode(selector: string): Text {
  return document.querySelector(selector)!.firstChild as Text;
}

beforeEach(() => {
  document.documentElement.className = 'docs-doc-page';
  document.body.innerHTML = `
    <nav class="navbar">Site nav words here</nav>
    <main>
      <div class="markdown">
        <header><h1>Docs as product</h1></header>
        <p id="intro">Documentation is part of the product.</p>
        <h2 id="buy-in">Buy-in<a class="hash-link" href="#buy-in">\u200B</a></h2>
        <p id="p1">Sean Huck approaches the problem from the organizational side.</p>
        <h3 id="org-side">Organizational side<a class="hash-link" href="#org-side">\u200B</a></h3>
        <p id="p2">He manages nine writers and formalizes their role.</p>
        <p id="p3">One of our big goals is to be included.</p>
        <pre><code id="code">npm install the plugin now</code></pre>
        <h2 id="later">Later</h2>
        <p>Something else entirely.</p>
      </div>
    </main>`;
});

describe('eligibleRoot', () => {
  it('accepts selections inside the content area', () => {
    const selection = selectText(textNode('#p2'), 0, textNode('#p2'), 24);
    expect(eligibleRoot(selection, options)).toBe(document.querySelector('.markdown'));
  });

  it('ignores selections shorter than minWords', () => {
    const selection = selectText(textNode('#p2'), 0, textNode('#p2'), 10);
    expect(eligibleRoot(selection, options)).toBeNull();
  });

  it('ignores selections outside the content area', () => {
    const selection = selectText(textNode('.navbar'), 0, textNode('.navbar'), 19);
    expect(eligibleRoot(selection, options)).toBeNull();
  });

  it('ignores selections that leave the content area', () => {
    const selection = selectText(textNode('.navbar'), 0, textNode('#p1'), 10);
    expect(eligibleRoot(selection, options)).toBeNull();
  });

  it('ignores selections inside code', () => {
    const selection = selectText(textNode('#code'), 0, textNode('#code'), 20);
    expect(eligibleRoot(selection, options)).toBeNull();
  });

  it('ignores collapsed selections', () => {
    const selection = selectText(textNode('#p2'), 3, textNode('#p2'), 3);
    expect(eligibleRoot(selection, options)).toBeNull();
  });
});

describe('rangeText', () => {
  it('separates block elements with blank lines and skips heading anchors', () => {
    const range = document.createRange();
    range.setStart(textNode('#p1'), 0);
    range.setEnd(textNode('#p2'), 11);
    expect(rangeText(range)).toBe(
      'Sean Huck approaches the problem from the organizational side.\n\nOrganizational side\n\nHe manages '
    );
  });
});

describe('enclosingSections', () => {
  it('returns the heading chain and the deepest heading id', () => {
    const root = document.querySelector('.markdown')!;
    expect(enclosingSections(root, textNode('#p2'))).toEqual({
      sections: ['Buy-in', 'Organizational side'],
      headingId: 'org-side',
    });
  });

  it('pops headings at the same or a higher level', () => {
    const root = document.querySelector('.markdown')!;
    const lastParagraph = root.querySelector('#later')!.nextElementSibling!.firstChild!;
    expect(enclosingSections(root, lastParagraph)).toEqual({
      sections: ['Later'],
      headingId: 'later',
    });
  });

  it('has no sections before the first heading', () => {
    const root = document.querySelector('.markdown')!;
    expect(enclosingSections(root, textNode('#intro'))).toEqual({
      sections: [],
      headingId: undefined,
    });
  });
});

describe('markdownUrlFor', () => {
  it('builds the Markdown URL on docs pages', () => {
    expect(markdownUrlFor(location, 'index.md')).toBe('https://site.dev/docs/guide/index.md');
  });

  it('is undefined off docs pages or without a filename', () => {
    expect(markdownUrlFor(location, false)).toBeUndefined();
    document.documentElement.className = '';
    expect(markdownUrlFor(location, 'index.md')).toBeUndefined();
  });
});

describe('captureSelection', () => {
  it('captures text, context, title, sections and a deep link', () => {
    const root = document.querySelector('.markdown')!;
    const range = document.createRange();
    range.setStart(textNode('#p2'), 3);
    range.setEnd(textNode('#p2'), 23);

    const snapshot = captureSelection(range, root, options, location);

    expect(snapshot).toEqual({
      text: 'manages nine writers',
      before: expect.stringMatching(
        /^Docs as product\n\n[^]*organizational side\.\n\nOrganizational side\n\nHe $/
      ),
      after: expect.stringMatching(
        /^ and formalizes their role\.\n\nOne of our big goals[^]*entirely\.$/
      ),
      title: 'Docs as product',
      sections: ['Buy-in', 'Organizational side'],
      link: 'https://site.dev/docs/guide?v=2#org-side:~:text=manages%20nine%20writers',
      markdownUrl: 'https://site.dev/docs/guide/index.md',
    });
  });

  it('skips the text fragment when disabled', () => {
    const root = document.querySelector('.markdown')!;
    const range = document.createRange();
    range.setStart(textNode('#p2'), 3);
    range.setEnd(textNode('#p2'), 23);
    expect(captureSelection(range, root, { ...options, textFragments: false }, location).link).toBe(
      'https://site.dev/docs/guide?v=2#org-side'
    );
  });
});
