# Claude Code instructions

## Project

`docusaurus-plugin-share-selection`, a Docusaurus v3 plugin that shows a share palette when readers highlight text. It's a standalone repo and npm package. Don't introduce a workspace spanning sibling plugin repos.

## Architecture

- `src/index.ts`: server-side plugin. Resolves options, reads `docusaurus-plugin-open-with-llm`'s content in `allContentLoaded`, injects the config as a JSON `<script>` tag, and registers the client module.
- `src/options.ts`: option defaults and validation. Throws `ShareSelectionOptionsError`.
- `src/core/`: framework-free logic, all unit tested.
  - `capture.ts`: reads the DOM (eligibility, text with paragraph breaks, headings, context).
  - `textFragment.ts`: builds `#heading:~:text=` deep links.
  - `formats.ts`: clipboard, Markdown, share URL, and AI prompt output.
  - `template.ts`: `{placeholder}` rendering.
- `src/client/`: the client module, in vanilla DOM (no React, no theme overrides, so nothing to collide with).

The client module is built as ESM only, with `styles.css` copied beside it.

## Commands

```bash
npm test              # Vitest unit tests
npm run typecheck
npm run lint
npm run build
npm run example:start # examples/docusaurus-v3
npm run test:e2e      # Playwright, needs `npm run example:build` first
```

## Shared docs site

User-facing changes also need updating in `~/Development/docusaurus/docusaurus-plugins-docs/docs/share-selection/` (a separate repo), as well as in this README.
