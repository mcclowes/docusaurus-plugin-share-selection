import type { SelectionSnapshot } from './formats';
import { buildDeepLink, buildTextDirective } from './textFragment';

export interface CaptureOptions {
  contentSelector: string;
  excludeSelector: string;
  minWords: number;
  contextChars: number;
  textFragments: boolean;
  markdownFile: string | false;
}

const BLOCK_SELECTOR =
  'p, li, blockquote, pre, h1, h2, h3, h4, h5, h6, td, th, dt, dd, figcaption, tr, table, ul, ol, div, section, article, header, details, summary';
/** Chrome that never belongs in quoted text: heading anchors, copy buttons, and invisible content. */
const NOISE_SELECTOR = '.hash-link, button, script, style, noscript, [aria-hidden="true"]';
const HEADING_SELECTOR = 'h2, h3, h4, h5, h6';
const DOCS_PAGE_CLASS = 'docs-doc-page';

function elementOf(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

/**
 * Returns the content root a selection belongs to, or null when the palette
 * shouldn't appear: nothing selected, the selection leaves the content area,
 * it sits entirely inside an excluded element, or it's too short.
 */
export function eligibleRoot(selection: Selection | null, options: CaptureOptions): Element | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const start = elementOf(range.startContainer);
  const end = elementOf(range.endContainer);
  const root = start?.closest(options.contentSelector);
  if (!root || !end || !root.contains(end)) return null;
  if (elementOf(range.commonAncestorContainer)?.closest(options.excludeSelector)) return null;
  const wordCount = selection.toString().trim().split(/\s+/).filter(Boolean).length;
  return wordCount >= options.minWords ? root : null;
}

/**
 * Reads the text inside a range, dropping UI chrome and separating block
 * elements with blank lines so paragraphs survive into the output.
 */
export function rangeText(range: Range): string {
  const container = range.commonAncestorContainer;
  const walkerRoot = container.nodeType === Node.TEXT_NODE ? container.parentNode! : container;
  const walker = document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT);
  const chunks: string[] = [];
  let lastBlock: Element | null = null;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!range.intersectsNode(node)) continue;
    const parent = node.parentElement;
    if (parent?.closest(NOISE_SELECTOR)) continue;

    let value = node.nodeValue ?? '';
    if (node === range.endContainer) value = value.slice(0, range.endOffset);
    if (node === range.startContainer) value = value.slice(range.startOffset);
    if (!value) continue;

    const block = parent?.closest(BLOCK_SELECTOR) ?? null;
    if (lastBlock && block !== lastBlock && chunks.length > 0) chunks.push('\n\n');
    lastBlock = block;
    chunks.push(value.replace(/[ \t\r\n]+/g, ' '));
  }

  return chunks
    .join('')
    .replace(/ *\n\n */g, '\n\n')
    .replace(/(\n\n)+/g, '\n\n');
}

function headingText(heading: Element): string {
  const clone = heading.cloneNode(true) as Element;
  clone.querySelectorAll(NOISE_SELECTOR).forEach(node => node.remove());
  return (clone.textContent ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The chain of headings above `node`, e.g. H2 › H3, with the deepest heading's id. */
export function enclosingSections(
  root: Element,
  node: Node
): { sections: string[]; headingId?: string } {
  const stack: Array<{ level: number; text: string; id: string }> = [];
  for (const heading of Array.from(root.querySelectorAll(HEADING_SELECTOR))) {
    // FOLLOWING also covers a selection that starts inside the heading itself.
    if (!(heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
    const level = Number(heading.tagName[1]);
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    stack.push({ level, text: headingText(heading), id: heading.id });
  }
  const withId = [...stack].reverse().find(entry => entry.id);
  return { sections: stack.map(entry => entry.text), headingId: withId?.id };
}

function pageTitle(root: Element): string {
  const heading =
    root.querySelector('h1') ??
    root.closest('article')?.querySelector('h1') ??
    document.querySelector('main h1') ??
    document.querySelector('h1');
  return heading ? headingText(heading) : document.title;
}

export function markdownUrlFor(
  location: Location,
  markdownFile: string | false
): string | undefined {
  if (!markdownFile || !document.documentElement.classList.contains(DOCS_PAGE_CLASS))
    return undefined;
  const route = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
  return `${location.origin}${route}${markdownFile}`;
}

function textBefore(root: Element, range: Range): string {
  const before = document.createRange();
  before.setStart(root, 0);
  before.setEnd(range.startContainer, range.startOffset);
  return rangeText(before).trimStart();
}

function textAfter(root: Element, range: Range): string {
  const after = document.createRange();
  after.setStart(range.endContainer, range.endOffset);
  after.setEnd(root, root.childNodes.length);
  return rangeText(after).trimEnd();
}

function pageText(): string {
  const body = document.createRange();
  body.selectNodeContents(document.body);
  return rangeText(body);
}

/** Captures everything needed to share a selection. Call it when an action runs, not on every selection change. */
export function captureSelection(
  range: Range,
  root: Element,
  options: CaptureOptions,
  location: Location = window.location
): SelectionSnapshot {
  const text = rangeText(range).trim();
  const before = textBefore(root, range);
  const after = textAfter(root, range);
  const { sections, headingId } = enclosingSections(root, range.startContainer);
  const title = pageTitle(root);
  const pageUrl = `${location.origin}${location.pathname}${location.search}`;
  const directive = options.textFragments
    ? buildTextDirective({ text, before, after, pageText: pageText() })
    : '';
  const contextSlack = options.contextChars + 80;

  return {
    text,
    before: before.slice(-contextSlack),
    after: after.slice(0, contextSlack),
    title,
    sections: sections.filter(section => section !== title),
    link: buildDeepLink(pageUrl, headingId, directive),
    markdownUrl: markdownUrlFor(location, options.markdownFile),
  };
}
