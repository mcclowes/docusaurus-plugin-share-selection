import { expect, test, type Page } from '@playwright/test';

const palette = (page: Page) => page.getByRole('toolbar', { name: 'Share selection' });

/** Selects `phrase` inside the first element matching `selector`, as a drag would. */
async function selectPhrase(page: Page, selector: string, phrase: string) {
  await page.evaluate(
    ([sel, text]) => {
      const element = document.querySelector(sel)!;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const index = node.nodeValue!.indexOf(text);
        if (index === -1) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      throw new Error(`"${text}" not found in ${sel}`);
    },
    [selector, phrase] as const
  );
}

async function readClipboard(page: Page) {
  return page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const read = async (type: string) =>
      item.types.includes(type) ? (await item.getType(type)).text() : '';
    return { html: await read('text/html'), plain: await read('text/plain') };
  });
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await context.route(/https:\/\/(claude\.ai|chatgpt\.com|github\.com)\//, route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: 'stub' })
  );
});

test('shows the palette for prose and hides it for code', async ({ page }) => {
  await page.goto('/docs/intro');
  await expect(palette(page)).toBeHidden();

  await page.locator('article p').first().click({ clickCount: 3 });
  await expect(palette(page)).toBeVisible();
  await expect(palette(page).getByRole('button')).toHaveText([
    'Copy',
    'Ask AI',
    'Copy Markdown',
    'Report issue',
  ]);

  await page.keyboard.press('Escape');
  await expect(palette(page)).toBeHidden();

  await selectPhrase(page, 'article pre', 'npm install docusaurus');
  await page.waitForTimeout(400);
  await expect(palette(page)).toBeHidden();
});

test('copies a quote with a deep link that lands on the passage', async ({ page }) => {
  await page.goto('/docs/docs-as-product');
  await selectPhrase(page, 'article', 'He manages nine writers');
  await palette(page).getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(palette(page).getByRole('button', { name: 'Copied' })).toBeVisible();

  const { html, plain } = await readClipboard(page);
  const link = plain.trim().split('\n').at(-1)!;
  expect(plain).toContain('> He manages nine writers');
  expect(plain).toContain('— Docs as product › Organizational buy-in › The organizational side');
  expect(link).toBe(
    'http://localhost:3000/docs/docs-as-product#the-organizational-side:~:text=He%20manages%20nine%20writers'
  );
  expect(html).toContain('<blockquote>He manages nine writers</blockquote>');
  expect(html).toContain(`href="${link}"`);

  await page.goto('/docs/intro');
  await page.goto(link);
  await expect(page.locator('#the-organizational-side')).toBeInViewport();
});

test('asks AI with the passage and its context', async ({ page, context }) => {
  await page.goto('/docs/docs-as-product');
  await selectPhrase(page, 'article', 'Search terms with no results are a better signal');
  await palette(page).getByRole('button', { name: 'Ask AI' }).click();
  await expect(palette(page).getByRole('button')).toHaveText([
    '‹',
    'ChatGPT',
    'Claude',
    'Copy prompt',
  ]);

  const popupPromise = context.waitForEvent('page');
  await palette(page).getByRole('button', { name: 'Claude' }).click();
  const popup = await popupPromise;
  const url = new URL(popup.url());
  expect(url.origin + url.pathname).toBe('https://claude.ai/new');

  const prompt = url.searchParams.get('q')!;
  expect(prompt).toContain('I\'m reading "Docs as product"');
  expect(prompt).toContain('Section: Measuring impact');
  expect(prompt).toContain('Search terms with no results are a better signal');
  expect(prompt).toContain('Page views say little on their own. [[PASSAGE]] of what');
  expect(prompt).toContain(
    'Full page as Markdown: http://localhost:3000/docs/docs-as-product/index.md'
  );
  await expect(palette(page)).toBeHidden();
});

test('disambiguates repeated phrases with context terms', async ({ page }) => {
  await page.goto('/docs/docs-as-product');
  await page.evaluate(() => {
    const paragraphs = [...document.querySelectorAll('article p')];
    const target = paragraphs.find(p => p.textContent!.startsWith('This second paragraph'))!;
    const node = target.firstChild!;
    const index = node.nodeValue!.lastIndexOf('the right one');
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + 'the right one'.length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
  });
  await palette(page).getByRole('button', { name: 'Copy Markdown' }).click();
  await expect(palette(page).getByRole('button', { name: 'Copied' })).toBeVisible();
  const { plain } = await readClipboard(page);
  // "the right one" appears three times, so the link pins it with the words either side.
  expect(plain).toMatch(/#repeated-phrases:~:text=place%20instead%20of-,the%20right%20one,-\.\)$/);
});

test('custom actions open a pre-filled URL', async ({ page, context }) => {
  await page.goto('/docs/docs-as-product');
  await selectPhrase(page, 'article', 'Track searches that return nothing');
  const popupPromise = context.waitForEvent('page');
  await palette(page).getByRole('button', { name: 'Report issue' }).click();
  const url = new URL((await popupPromise).url());
  expect(url.searchParams.get('title')).toBe('Docs: Docs as product');
  expect(url.searchParams.get('body')).toContain('> Track searches that return nothing');
});

test('works on blog posts', async ({ page }) => {
  await page.goto('/blog/2026/09/22/welcome');
  await selectPhrase(page, 'article', 'Blog posts get the same palette');
  await expect(palette(page)).toBeVisible();
  await palette(page).getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(palette(page).getByRole('button', { name: 'Copied' })).toBeVisible();
  const { plain } = await readClipboard(page);
  expect(plain).toContain('— Sharing passages from a blog post');
});
