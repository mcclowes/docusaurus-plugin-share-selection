import { ACTION_EVENT } from '../constants';
import { captureSelection, eligibleRoot, type CaptureOptions } from '../core/capture';
import {
  buildPrompt,
  buildProviderUrl,
  customActionUrl,
  shareUrl,
  toHtml,
  toMarkdown,
  toPlainText,
  truncate,
  type SelectionSnapshot,
} from '../core/formats';
import type { ClientConfig, ProviderOptions, ResolvedAction } from '../types';
import { copyRich, copyText } from './clipboard';

const GAP = 8;
const SELECTION_SETTLE_MS = 150;
const FEEDBACK_MS = 1200;
/** Touch browsers can clear the selection when a palette button is tapped; ignore that briefly. */
const TAP_GRACE_MS = 600;

interface Target {
  range: Range;
  root: Element;
}

export interface Palette {
  element: HTMLElement;
  evaluate(): void;
  hide(): void;
  destroy(): void;
}

function openInNewTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function canUseNativeShare(): boolean {
  return (
    typeof navigator.share === 'function' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

function prefersBelow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

function navbarBottom(): number {
  const navbar = document.querySelector('.navbar');
  return navbar ? Math.max(0, navbar.getBoundingClientRect().bottom) : 0;
}

export function createPalette(config: ClientConfig): Palette {
  const captureOptions: CaptureOptions = { ...config, markdownFile: config.ai.markdownFile };
  const element = document.createElement('div');
  element.className = 'share-selection';
  element.setAttribute('role', 'toolbar');
  element.setAttribute('aria-label', 'Share selection');
  element.hidden = true;
  document.body.append(element);

  let target: Target | null = null;
  let view: 'main' | 'ai' = 'main';
  let dragging = false;
  let tappedAt = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

  function report(action: string, snapshot: SelectionSnapshot) {
    window.dispatchEvent(
      new CustomEvent(ACTION_EVENT, {
        detail: { action, text: snapshot.text, link: snapshot.link, title: snapshot.title },
      })
    );
  }

  function flash(button: HTMLButtonElement, message: string) {
    button.textContent = message;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(hide, FEEDBACK_MS);
  }

  function makeButton(label: string, onClick: (button: HTMLButtonElement) => void) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'share-selection__button';
    button.textContent = label;
    button.addEventListener('click', () => {
      if (target) onClick(button);
    });
    return button;
  }

  function snapshot(): SelectionSnapshot {
    return captureSelection(target!.range, target!.root, captureOptions);
  }

  function runAction(action: ResolvedAction, button: HTMLButtonElement) {
    const snap = snapshot();
    const reportAs = action.kind === 'custom' ? action.label : action.id;

    if (action.kind === 'custom') {
      openInNewTab(customActionUrl(action.url, snap));
      hide();
    } else if (action.id === 'copy') {
      void copyRich(toHtml(snap), toPlainText(snap)).then(ok =>
        flash(button, ok ? 'Copied' : 'Copy failed')
      );
    } else if (action.id === 'markdown') {
      void copyText(toMarkdown(snap)).then(ok => flash(button, ok ? 'Copied' : 'Copy failed'));
    } else if (action.id === 'ai') {
      if (config.ai.providers.length > 0) {
        view = 'ai';
        render();
        return;
      }
      void copyText(buildPrompt(snap, config.ai.prompt, config.contextChars)).then(ok =>
        flash(button, ok ? 'Prompt copied' : 'Copy failed')
      );
    } else if (action.id === 'share') {
      void navigator
        .share({ title: snap.title, text: `“${truncate(snap.text, 200)}”`, url: snap.link })
        .catch(() => undefined);
      hide();
    } else {
      const url = shareUrl(action.id, snap);
      if (url) openInNewTab(url);
      hide();
    }
    report(reportAs, snap);
  }

  function openProvider(provider: ProviderOptions) {
    const snap = snapshot();
    openInNewTab(buildProviderUrl(provider, snap, config.ai, config.contextChars));
    report(`ai:${provider.label}`, snap);
    hide();
  }

  function copyPrompt(button: HTMLButtonElement) {
    const snap = snapshot();
    void copyText(buildPrompt(snap, config.ai.prompt, config.contextChars)).then(ok =>
      flash(button, ok ? 'Copied' : 'Copy failed')
    );
    report('ai:copy', snap);
  }

  function mainButtons(): HTMLButtonElement[] {
    return config.actions
      .filter(action => action.kind === 'custom' || action.id !== 'share' || canUseNativeShare())
      .map(action => makeButton(action.label, button => runAction(action, button)));
  }

  function aiButtons(): HTMLButtonElement[] {
    const back = makeButton('‹', () => {
      view = 'main';
      render();
    });
    back.setAttribute('aria-label', 'Back');
    return [
      back,
      ...config.ai.providers.map(provider =>
        makeButton(provider.label, () => openProvider(provider))
      ),
      makeButton('Copy prompt', copyPrompt),
    ];
  }

  function position() {
    if (!target) return;
    const rect =
      typeof target.range.getBoundingClientRect === 'function'
        ? target.range.getBoundingClientRect()
        : target.root.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = element;

    const above = rect.top - height - GAP;
    const top = prefersBelow() || above < navbarBottom() + GAP ? rect.bottom + GAP : above;
    const centred = rect.left + rect.width / 2 - width / 2;
    const left = Math.min(Math.max(GAP, centred), window.innerWidth - width - GAP);

    element.style.top = `${Math.round(top + window.scrollY)}px`;
    element.style.left = `${Math.round(Math.max(GAP, left) + window.scrollX)}px`;
  }

  function render() {
    const hadFocus = element.contains(document.activeElement);
    element.replaceChildren(...(view === 'main' ? mainButtons() : aiButtons()));
    element.hidden = element.childElementCount === 0;
    position();
    if (hadFocus) (element.firstElementChild as HTMLElement | null)?.focus();
  }

  function hide() {
    clearTimeout(feedbackTimer);
    element.hidden = true;
    target = null;
    view = 'main';
  }

  function evaluate() {
    if (Date.now() - tappedAt < TAP_GRACE_MS) return;
    const selection = window.getSelection();
    const root = eligibleRoot(selection, captureOptions);
    if (!root || !selection) {
      hide();
      return;
    }
    const range = selection.getRangeAt(0);
    if (target && target.range.toString() === range.toString() && !element.hidden) {
      position();
      return;
    }
    target = { range: range.cloneRange(), root };
    view = 'main';
    render();
  }

  const onPointerDown = (event: PointerEvent) => {
    if (element.contains(event.target as Node)) {
      tappedAt = Date.now();
      return;
    }
    dragging = true;
    if (target) hide();
  };
  const onPointerUp = () => {
    if (!dragging) return;
    dragging = false;
    setTimeout(evaluate, 0);
  };
  const onSelectionChange = () => {
    clearTimeout(settleTimer);
    if (!dragging) settleTimer = setTimeout(evaluate, SELECTION_SETTLE_MS);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !element.hidden) hide();
  };
  const onResize = () => {
    if (!element.hidden) position();
  };
  // Keeps the selection intact when a palette button is pressed.
  const keepSelection = (event: MouseEvent) => event.preventDefault();

  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  element.addEventListener('mousedown', keepSelection);

  return {
    element,
    evaluate,
    hide,
    destroy() {
      clearTimeout(settleTimer);
      clearTimeout(feedbackTimer);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      element.remove();
    },
  };
}
