export interface SelectionBookmark {
  range: Range;
  origin: HTMLElement | null;
  backward: boolean;
}

export function sameRange(a: Range, b: Range): boolean {
  return (
    a.startContainer === b.startContainer &&
    a.startOffset === b.startOffset &&
    a.endContainer === b.endContainer &&
    a.endOffset === b.endOffset
  );
}

function selectionOrigin(range: Range, root: Element): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && root.contains(active)) return active;
  const node = range.startContainer;
  const origin = node instanceof HTMLElement ? node : node.parentElement;
  if (origin instanceof HTMLElement) return origin;
  return root instanceof HTMLElement ? root : null;
}

export function captureSelectionBookmark(selection: Selection, root: Element): SelectionBookmark {
  const range = selection.getRangeAt(0);
  return {
    range: range.cloneRange(),
    origin: selectionOrigin(range, root),
    backward:
      selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset,
  };
}

export function restoreSelectionBookmark(saved: SelectionBookmark): void {
  const origin = saved.origin;
  if (!origin?.isConnected) return;
  if (origin.tabIndex < 0 && !origin.hasAttribute('tabindex')) {
    origin.setAttribute('tabindex', '-1');
    origin.addEventListener('blur', () => origin.removeAttribute('tabindex'), { once: true });
  }
  origin.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection || !saved.range.startContainer.isConnected) return;
  selection.removeAllRanges();
  if (saved.backward && typeof selection.setBaseAndExtent === 'function') {
    selection.setBaseAndExtent(
      saved.range.endContainer,
      saved.range.endOffset,
      saved.range.startContainer,
      saved.range.startOffset
    );
  } else selection.addRange(saved.range.cloneRange());
}
