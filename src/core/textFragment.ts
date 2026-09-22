const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** Passages up to this many words are matched exactly; longer ones use `start,end`. */
const EXACT_MATCH_WORDS = 10;
const RANGE_EDGE_WORDS = 4;
const CONTEXT_WORDS = 3;

export function normalizeText(text: string): string {
  return text.replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim();
}

function words(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(' ') : [];
}

/** Text fragment terms must be percent-encoded, including the `-`, `,` and `&` the syntax reserves. */
export function encodeFragmentTerm(term: string): string {
  return encodeURIComponent(term).replace(/-/g, '%2D');
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + 1);
  }
  return count;
}

export interface FragmentInput {
  /** The selected text. */
  text: string;
  /** Text immediately before the selection, used to trim partial words and disambiguate. */
  before?: string;
  /** Text immediately after the selection. */
  after?: string;
  /** All text on the page, used to decide whether the passage needs a prefix or suffix. */
  pageText?: string;
}

/**
 * Builds a text directive (`text=...`) for a URL's `:~:` fragment directive.
 * Browsers only match whole words, so words the selection cut in half are dropped.
 * Returns an empty string when there's nothing matchable left.
 */
export function buildTextDirective({
  text,
  before = '',
  after = '',
  pageText,
}: FragmentInput): string {
  const selected = words(text);
  const rawText = text.replace(ZERO_WIDTH, '');
  const rawBefore = before.replace(ZERO_WIDTH, '');
  const rawAfter = after.replace(ZERO_WIDTH, '');

  const startsMidWord =
    WORD_CHAR.test(rawBefore.slice(-1)) && WORD_CHAR.test(rawText.trimStart()[0] ?? '');
  const endsMidWord =
    WORD_CHAR.test(rawAfter[0] ?? '') && WORD_CHAR.test(rawText.trimEnd().slice(-1));
  if (startsMidWord) selected.shift();
  if (endsMidWord) selected.pop();
  if (selected.length === 0) return '';

  const parts: string[] = [];
  const exact = selected.length <= EXACT_MATCH_WORDS;
  const start = exact ? selected.join(' ') : selected.slice(0, RANGE_EDGE_WORDS).join(' ');
  const end = exact ? '' : selected.slice(-RANGE_EDGE_WORDS).join(' ');

  const page = pageText ? normalizeText(pageText) : undefined;
  const ambiguousStart = page !== undefined && countOccurrences(page, start) > 1;
  const ambiguousEnd = page !== undefined && end !== '' && countOccurrences(page, end) > 1;

  if (ambiguousStart && !startsMidWord) {
    const prefix = words(before).slice(-CONTEXT_WORDS).join(' ');
    if (prefix) parts.push(`${encodeFragmentTerm(prefix)}-`);
  }
  parts.push(encodeFragmentTerm(start));
  if (end) parts.push(encodeFragmentTerm(end));
  if ((ambiguousEnd || (ambiguousStart && !end)) && !endsMidWord) {
    const suffix = words(after).slice(0, CONTEXT_WORDS).join(' ');
    if (suffix) parts.push(`-${encodeFragmentTerm(suffix)}`);
  }

  return `text=${parts.join(',')}`;
}

/** Joins a page URL, an optional heading id and an optional text directive. */
export function buildDeepLink(pageUrl: string, headingId?: string, textDirective?: string): string {
  const base = pageUrl.split('#')[0];
  const hash = headingId ? encodeURIComponent(headingId) : '';
  if (textDirective) return `${base}#${hash}:~:${textDirective}`;
  return hash ? `${base}#${hash}` : base;
}
