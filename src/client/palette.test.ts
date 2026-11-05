import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveOptions } from '../options';
import { createPalette, type Palette } from './palette';

let palette: Palette;
let origin: HTMLElement;

function select(element = origin) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  palette.evaluate();
}

function press(key: string, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  document.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = `<article class="markdown"><h1>Keyboard guide</h1>
    <p id="origin" tabindex="0">A selected passage with enough words.</p></article>`;
  origin = document.getElementById('origin')!;
  origin.focus();
  palette = createPalette(resolveOptions({ actions: ['copy', 'ai'] }));
});

afterEach(() => {
  palette.destroy();
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('keyboard access to the palette', () => {
  it('focuses the first action with Alt+Shift+S and advertises the shortcut', () => {
    select();
    const event = press('S', { code: 'KeyS', altKey: true, shiftKey: true });
    expect(document.activeElement).toBe(palette.element.querySelector('button'));
    expect(event.defaultPrevented).toBe(true);
    expect(palette.element.getAttribute('aria-keyshortcuts')).toBe('Alt+Shift+S');
  });

  it('keeps the captured passage while focused and returns to it on Escape without reopening', () => {
    select();
    press('S', { code: 'KeyS', altKey: true, shiftKey: true });
    window.getSelection()!.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    vi.advanceTimersByTime(200);
    expect(palette.element.hidden).toBe(false);

    press('Escape');
    expect(palette.element.hidden).toBe(true);
    expect(document.activeElement).toBe(origin);
    expect(window.getSelection()!.toString()).toBe(origin.textContent);
    vi.advanceTimersByTime(200);
    palette.evaluate();
    expect(palette.element.hidden).toBe(true);
  });

  it('does not intercept the shortcut when hidden or when other modifiers are held', () => {
    expect(press('S', { altKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    select();
    expect(press('S', { altKey: true, shiftKey: true, ctrlKey: true }).defaultPrevented).toBe(
      false
    );
    expect(document.activeElement).toBe(origin);
    expect(press('S', { altKey: true }).defaultPrevented).toBe(false);
  });

  it('supports Option-modified characters and keeps focus through the AI submenu', () => {
    select();
    press('Í', { code: 'KeyS', altKey: true, shiftKey: true });
    const ai = [...palette.element.querySelectorAll('button')].find(
      button => button.textContent === 'Ask AI'
    )!;
    ai.focus();
    ai.click();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Back');
    press('Escape');
    expect(document.activeElement).toBe(origin);
  });

  it('reopens for a new gesture even when the same passage is selected again', () => {
    select();
    press('Escape');
    document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(palette.element.hidden).toBe(false);
  });
});
