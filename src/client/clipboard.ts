/** Writes through a synthetic copy event, which works where the async Clipboard API is missing or blocked. */
function copyViaCopyEvent(data: Record<string, string>): boolean {
  let written = false;
  const onCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    for (const [type, value] of Object.entries(data)) event.clipboardData.setData(type, value);
    event.preventDefault();
    written = true;
  };
  document.addEventListener('copy', onCopy, { once: true });
  try {
    document.execCommand('copy');
  } catch {
    // Ignored: `written` stays false.
  }
  document.removeEventListener('copy', onCopy);
  return written;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyViaCopyEvent({ 'text/plain': text });
  }
}

/** Copies HTML plus a plain-text fallback, so rich editors keep links and plain ones still get the URL. */
export async function copyRich(html: string, plain: string): Promise<boolean> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch {
      // Fall through to the copy-event path.
    }
  }
  return copyViaCopyEvent({ 'text/html': html, 'text/plain': plain });
}
