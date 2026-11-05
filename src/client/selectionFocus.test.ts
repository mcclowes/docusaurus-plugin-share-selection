import { afterEach, beforeEach, expect, it } from 'vitest';
import { captureSelectionBookmark, restoreSelectionBookmark } from './selectionFocus';

beforeEach(() => {
  document.body.innerHTML = `<article><p>A selected passage with enough words.</p></article><button>Other</button>`;
});

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

it('returns to ordinary prose without permanently adding a tab stop', () => {
  const paragraph = document.querySelector('p')!;
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  const selection = window.getSelection()!;
  selection.addRange(range);
  const bookmark = captureSelectionBookmark(selection, document.querySelector('article')!);
  document.querySelector('button')!.focus();
  selection.removeAllRanges();

  restoreSelectionBookmark(bookmark);
  expect(document.activeElement).toBe(paragraph);
  expect(selection.toString()).toBe(paragraph.textContent);
  document.querySelector('button')!.focus();
  expect(paragraph.hasAttribute('tabindex')).toBe(false);
});

it('restores the direction of a backward keyboard selection', () => {
  const paragraph = document.querySelector('p')!;
  const text = paragraph.firstChild!;
  const selection = window.getSelection()!;
  selection.setBaseAndExtent(text, text.textContent!.length, text, 0);
  const bookmark = captureSelectionBookmark(selection, document.querySelector('article')!);
  document.querySelector('button')!.focus();
  selection.removeAllRanges();

  restoreSelectionBookmark(bookmark);
  expect(selection.anchorNode).toBe(text);
  expect(selection.anchorOffset).toBe(text.textContent!.length);
  expect(selection.focusNode).toBe(text);
  expect(selection.focusOffset).toBe(0);
});
