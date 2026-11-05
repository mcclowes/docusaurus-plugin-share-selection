import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type BrowserContext } from '@playwright/test';

test('reaches sharing actions from a keyboard selection and returns to the passage', async ({
  playwright,
  channel,
  baseURL,
}) => {
  const profile = await mkdtemp(join(tmpdir(), 'share-selection-keyboard-'));
  let context: BrowserContext | undefined;
  try {
    // Caret browsing enables native Shift+arrow selection in ordinary prose.
    await mkdir(join(profile, 'Default'));
    await writeFile(
      join(profile, 'Default', 'Preferences'),
      JSON.stringify({
        settings: { a11y: { caretbrowsing: { enabled: true, show_dialog: false } } },
      })
    );
    context = await playwright.chromium.launchPersistentContext(profile, { channel, baseURL });
    const page = context.pages()[0];
    await page.goto('/docs/intro');
    const paragraph = page.locator('article p').first();
    await paragraph.evaluate(element => {
      element.setAttribute('tabindex', '0');
      (element as HTMLElement).focus();
      const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!;
      window.getSelection()!.collapse(text, 0);
    });
    await page.keyboard.down('Shift');
    for (let i = 0; i < 35; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');
    const selected = await page.evaluate(() => window.getSelection()!.toString());
    expect(selected.trim().split(/\s+/).length).toBeGreaterThanOrEqual(3);
    const palette = page.getByRole('toolbar', { name: 'Share selection' });
    await expect(palette).toBeVisible();
    await expect(palette).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+S');

    await page.keyboard.press('Alt+Shift+S');
    await expect(palette.getByRole('button', { name: 'Copy', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(palette.getByRole('button', { name: 'Ask AI' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(palette.getByRole('button', { name: 'Back' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    await expect(paragraph).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()!.toString())).toBe(selected);
    await page.waitForTimeout(300);
    await expect(palette).toBeHidden();
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
