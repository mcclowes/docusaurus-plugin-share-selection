# docusaurus-plugin-share-selection

[![npm version](https://img.shields.io/npm/v/docusaurus-plugin-share-selection.svg)](https://www.npmjs.com/package/docusaurus-plugin-share-selection)
[![ci](https://github.com/mcclowes/docusaurus-plugin-share-selection/actions/workflows/ci.yml/badge.svg)](https://github.com/mcclowes/docusaurus-plugin-share-selection/actions/workflows/ci.yml)

Highlight text on a Docusaurus page and a small palette appears above it. Readers can copy the passage for Slack or Teams, ask an AI about it with the surrounding context, or share it. Every link points at the exact passage, not just the page.

```text
┌──────────────────────────────┐
│  Copy   Ask AI   Share       │
└──────────────────────────────┘
  He manages nine writers and is working to formalize…
```

## Features

- **Copy** writes a quote, the page and section, and a deep link. It puts HTML and plain text on the clipboard, so Slack, Teams, Notion, and Google Docs keep the link, and plain-text apps still get the URL.
- **Deep links** combine the nearest heading anchor with a [text fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments), so the page scrolls to the passage and highlights it. Browsers without text fragment support still land on the heading.
- **Ask AI** opens ChatGPT or Claude with the passage, its heading path, the text around it, and a link to the page's Markdown when there is one.
- **Share** uses the native share sheet on phones and tablets.
- **Custom actions** open any URL built from the selection. Use one for "Report an issue with this passage".
- Works alongside [`docusaurus-plugin-open-with-llm`](https://github.com/mcclowes/docusaurus-plugin-open-with-llm) and reuses its AI providers and Markdown filename.
- No theme component overrides and no React dependency, so it doesn't collide with other plugins or your own swizzled components.

## Install

```bash
npm install docusaurus-plugin-share-selection
```

```js
// docusaurus.config.js
export default {
  plugins: ['docusaurus-plugin-share-selection'],
};
```

That's it. The palette appears on docs pages, blog posts, and MDX pages.

## Configure

```js
export default {
  plugins: [
    [
      'docusaurus-plugin-share-selection',
      {
        actions: [
          'copy',
          'ai',
          'markdown',
          { action: 'share', label: 'Send' },
          {
            label: 'Report issue',
            url: 'https://github.com/acme/docs/issues/new?title=Docs:%20{title}&body={quote}',
          },
        ],
        minWords: 3,
        ai: {
          providers: [
            { label: 'Claude', url: 'https://claude.ai/new?q={prompt}' },
            { label: 'Perplexity', url: 'https://www.perplexity.ai/search?q={prompt}' },
          ],
        },
      },
    ],
  ],
};
```

| Option            | Type                | Default                                            | Purpose                                                                                 |
| ----------------- | ------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `enabled`         | `boolean`           | `true`                                             | Turn the palette off without removing the plugin.                                       |
| `actions`         | `ActionOptions[]`   | `['copy', 'ai', 'share']`                          | Buttons, in order. See [actions](#actions).                                             |
| `contentSelector` | `string`            | `'.markdown'`                                      | Where selections count. Docs, blog, and MDX pages all use `.markdown`.                  |
| `excludeSelector` | `string`            | `'pre, code, .hash-link, button, input, textarea'` | Selections entirely inside these are ignored.                                           |
| `minWords`        | `number`            | `3`                                                | Shortest selection that shows the palette.                                              |
| `contextChars`    | `number`            | `600`                                              | Characters of surrounding text sent to AI either side of the passage.                   |
| `textFragments`   | `boolean`           | `true`                                             | Add `:~:text=` to links so they highlight the passage.                                  |
| `ai.prompt`       | `string`            | See [AI prompt](#ai-prompt)                        | Prompt template.                                                                        |
| `ai.providers`    | `ProviderOptions[]` | open-with-llm's, else ChatGPT and Claude           | Each needs a `label` and a `url` containing `{prompt}`. `[]` copies the prompt instead. |
| `ai.markdownFile` | `string \| false`   | open-with-llm's `markdownFile`, else `false`       | Filename appended to docs routes for `{markdownUrl}`.                                   |
| `ai.maxUrlLength` | `number`            | `6000`                                             | Longest provider URL before context is trimmed from the prompt.                         |

### Actions

| Action     | What it does                                                               |
| ---------- | -------------------------------------------------------------------------- |
| `copy`     | Copies a quote, citation, and deep link as rich text and plain text.       |
| `markdown` | Copies a Markdown blockquote with a linked citation.                       |
| `ai`       | Shows a button per AI provider, plus "Copy prompt".                        |
| `share`    | Opens the native share sheet. Only shown on touch devices that support it. |
| `teams`    | Opens Microsoft Teams' share dialog.                                       |
| `linkedin` | Shares the link on LinkedIn.                                               |
| `x`        | Opens a post on X with the quote and link.                                 |
| `bluesky`  | Opens a Bluesky post with the quote and link.                              |

Relabel any built-in with `{ action: 'copy', label: 'Copy quote' }`.

Custom actions are `{ label, url }`. These placeholders are URL-encoded into `url`:

| Placeholder   | Value                                                     |
| ------------- | --------------------------------------------------------- |
| `{text}`      | The selected text.                                        |
| `{shortText}` | The selected text in quotes, cut to about 200 characters. |
| `{url}`       | Deep link to the passage.                                 |
| `{title}`     | Page title.                                               |
| `{section}`   | Page title and headings, e.g. `Guide › Setup › Tokens`.   |
| `{quote}`     | The same Markdown the `markdown` action copies.           |

Slack has no share URL, so **Copy** is the Slack path. The pasted message keeps the link.

### AI prompt

The default prompt:

```text
I'm reading "{title}" and want help with a passage from it.
Section: {section}
Page: {url}
Full page as Markdown: {markdownUrl}

Passage:
"""
{selection}
"""

Surrounding text, with the passage marked:
"""
{context}
"""

Help me understand this passage.
```

`{context}` is the text before and after the selection with `[[PASSAGE]]` where the selection sits. A line whose placeholders are all empty is dropped, so the Markdown line disappears on pages without a Markdown export.

Long prompts don't fit in a URL. When a provider URL would pass `ai.maxUrlLength`, the plugin trims the surrounding context, then the passage. **Copy prompt** always copies the full version.

## With open-with-llm

If `docusaurus-plugin-open-with-llm` is installed, this plugin picks up its `providers` and `markdownFile`. Readers then see the same AI destinations in both places, and prompts link to the page's Markdown. Anything you set under `ai` here wins. Register the plugins in any order.

## Analytics

Every action dispatches a `share-selection` event on `window`:

```js
window.addEventListener('share-selection', event => {
  const { action, text, link, title } = event.detail;
  analytics.track('Passage shared', { action, title });
});
```

Tracking which passages readers quote, and which they ask AI about, is a useful signal for which docs are valuable and which are confusing.

## Styling

The palette is dark by default, with a lighter surface in dark mode. Override these CSS variables in your custom CSS:

```css
.share-selection {
  --share-selection-background: #1c1e21;
  --share-selection-color: #fff;
  --share-selection-hover: rgb(255 255 255 / 14%);
  --share-selection-radius: 12px;
}
```

## How it works

The plugin serializes its options into a JSON `<script>` tag and registers a client module. The client module listens for selection changes, shows the palette when a selection of at least `minWords` sits inside `contentSelector`, and reads the page (headings, surrounding text, and title) only when an action runs. Nothing is sent anywhere until a reader presses a button.

## Compatibility

- Docusaurus `^3.0.0`. Reusing open-with-llm settings needs a Docusaurus version with the `allContentLoaded` lifecycle.
- Node.js `>=20`

## Development

```bash
npm install
npm test              # unit tests (Vitest)
npm run build
npm run example:start # example site in examples/docusaurus-v3
npm run test:e2e      # Playwright, against the built example site
```

## License

MIT
