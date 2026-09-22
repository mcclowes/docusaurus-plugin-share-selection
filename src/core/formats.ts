import { renderTemplate, renderUrlTemplate } from './template';
import type { BuiltInActionId, ProviderOptions, ResolvedAiOptions } from '../types';

/** Everything the palette knows about a selection at the moment it's shared. */
export interface SelectionSnapshot {
  /** Selected text, with paragraph breaks kept as blank lines. */
  text: string;
  /** Text before and after the selection within the content area. */
  before: string;
  after: string;
  /** Page title (the h1, falling back to the document title). */
  title: string;
  /** Headings enclosing the selection, outermost first, excluding the title. */
  sections: string[];
  /** Deep link to the passage. */
  link: string;
  /** Markdown version of the page, when the site publishes one. */
  markdownUrl?: string;
}

const SHORT_TEXT_CHARS = 200;
const PASSAGE_MARKER = '[[PASSAGE]]';

export function citation(snapshot: SelectionSnapshot): string {
  return [snapshot.title, ...snapshot.sections].filter(Boolean).join(' › ');
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function truncate(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  // One extra character tells us whether the cut lands on a word boundary.
  const cut = clean.slice(0, maxChars + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, maxChars)).trimEnd()}…`;
}

/** Keeps the end of `text`, cut at a word boundary. */
function tail(text: string, maxChars: number): string {
  const clean = text.replace(/[ \t]+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(clean.length - maxChars - 1);
  const firstSpace = cut.indexOf(' ');
  return `…${(firstSpace >= 0 ? cut.slice(firstSpace + 1) : cut.slice(1)).trimStart()}`;
}

/** Keeps the start of `text`, cut at a word boundary. */
function head(text: string, maxChars: number): string {
  const clean = text.replace(/[ \t]+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return truncate(clean, maxChars);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeMarkdownLinkText(text: string): string {
  return text.replace(/([[\]\\])/g, '\\$1');
}

function quoteLines(text: string): string {
  return paragraphs(text)
    .map(paragraph => `> ${paragraph}`)
    .join('\n>\n');
}

/** Plain-text clipboard flavour: what lands in apps that don't take rich text. */
export function toPlainText(snapshot: SelectionSnapshot): string {
  return `${quoteLines(snapshot.text)}\n\n— ${citation(snapshot)}\n${snapshot.link}`;
}

/** Rich clipboard flavour: Slack, Teams, Notion, and docs editors keep the link. */
export function toHtml(snapshot: SelectionSnapshot): string {
  const body = paragraphs(snapshot.text).map(escapeHtml).join('<br><br>');
  return `<blockquote>${body}</blockquote><p>— <a href="${escapeHtml(snapshot.link)}">${escapeHtml(citation(snapshot))}</a></p>`;
}

export function toMarkdown(snapshot: SelectionSnapshot): string {
  return `${quoteLines(snapshot.text)}\n\n— [${escapeMarkdownLinkText(citation(snapshot))}](${snapshot.link})`;
}

/** Values available to custom action URLs. */
export function actionValues(snapshot: SelectionSnapshot): Record<string, string> {
  const text = paragraphs(snapshot.text).join('\n\n');
  return {
    text,
    shortText: `“${truncate(text, SHORT_TEXT_CHARS)}”`,
    url: snapshot.link,
    title: snapshot.title,
    section: citation(snapshot),
    quote: toMarkdown(snapshot),
  };
}

const SHARE_URLS: Partial<Record<BuiltInActionId, string>> = {
  teams: 'https://teams.microsoft.com/share?href={url}&msgText={shortText}',
  linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url={url}',
  x: 'https://x.com/intent/post?text={shortText}&url={url}',
  bluesky: 'https://bsky.app/intent/compose?text={shortText}%20{url}',
};

export function shareUrl(id: BuiltInActionId, snapshot: SelectionSnapshot): string | undefined {
  const template = SHARE_URLS[id];
  return template ? renderUrlTemplate(template, actionValues(snapshot)) : undefined;
}

export function customActionUrl(template: string, snapshot: SelectionSnapshot): string {
  return renderUrlTemplate(template, actionValues(snapshot));
}

function contextBlock(snapshot: SelectionSnapshot, contextChars: number): string {
  if (contextChars <= 0) return '';
  const before = tail(snapshot.before, contextChars);
  const after = head(snapshot.after, contextChars);
  if (!before && !after) return '';
  return [before, PASSAGE_MARKER, after].filter(Boolean).join(' ');
}

export function buildPrompt(
  snapshot: SelectionSnapshot,
  template: string,
  contextChars: number,
  maxSelectionChars = Infinity
): string {
  const text = paragraphs(snapshot.text).join('\n\n');
  return renderTemplate(template, {
    title: snapshot.title,
    section: snapshot.sections.join(' › '),
    url: snapshot.link,
    markdownUrl: snapshot.markdownUrl ?? '',
    selection: Number.isFinite(maxSelectionChars) ? truncate(text, maxSelectionChars) : text,
    context: contextBlock(snapshot, contextChars),
  });
}

function providerUrl(provider: ProviderOptions, prompt: string): string {
  return provider.url.replace(/\{prompt\}/g, encodeURIComponent(prompt));
}

/**
 * Builds a provider URL that fits `maxUrlLength`, shedding surrounding context
 * first and then shortening the passage. Long URLs get truncated or rejected by
 * some providers, so the palette also offers "Copy prompt" for the full version.
 */
export function buildProviderUrl(
  provider: ProviderOptions,
  snapshot: SelectionSnapshot,
  ai: ResolvedAiOptions,
  contextChars: number
): string {
  const attempts: Array<[number, number]> = [
    [contextChars, Infinity],
    [Math.floor(contextChars / 2), Infinity],
    [0, Infinity],
    [0, 1500],
    [0, 500],
  ];
  let url = '';
  for (const [context, selectionChars] of attempts) {
    url = providerUrl(provider, buildPrompt(snapshot, ai.prompt, context, selectionChars));
    if (url.length <= ai.maxUrlLength) return url;
  }
  return url;
}
