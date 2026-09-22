// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { LoadContext } from '@docusaurus/types';
import shareSelectionPlugin, { CONFIG_ELEMENT_ID, serializeConfig } from './index';
import { resolveOptions } from './options';

const context = {} as LoadContext;

function configFromTags(plugin: ReturnType<typeof shareSelectionPlugin>) {
  const tags = plugin.injectHtmlTags!({ content: undefined }) as {
    headTags: Array<{ attributes: Record<string, string>; innerHTML: string }>;
  };
  const [tag] = tags.headTags;
  expect(tag.attributes).toEqual({ type: 'application/json', id: CONFIG_ELEMENT_ID });
  return JSON.parse(tag.innerHTML);
}

function loadAll(
  plugin: ReturnType<typeof shareSelectionPlugin>,
  allContent: Record<string, unknown>
) {
  return plugin.allContentLoaded!({ allContent, actions: {} } as never);
}

describe('resolveOptions', () => {
  it('has sensible defaults', () => {
    const config = resolveOptions();
    expect(config.actions.map(action => action.label)).toEqual(['Copy', 'Ask AI', 'Share']);
    expect(config.ai.providers.map(provider => provider.label)).toEqual(['ChatGPT', 'Claude']);
    expect(config.ai.markdownFile).toBe(false);
    expect(config.minWords).toBe(3);
  });

  it('relabels built-ins and accepts custom actions', () => {
    const config = resolveOptions({
      actions: [
        { action: 'copy', label: 'Copy quote' },
        { label: 'Report', url: 'https://gh.dev/new?body={quote}' },
      ],
    });
    expect(config.actions).toEqual([
      { kind: 'builtin', id: 'copy', label: 'Copy quote' },
      { kind: 'custom', label: 'Report', url: 'https://gh.dev/new?body={quote}' },
    ]);
  });

  it.each([
    [{ actions: ['nope'] }, /unknown action "nope"/],
    [{ actions: [{ label: 'x' }] }, /need a `label` and a `url`/],
    [{ ai: { providers: [{ label: 'x', url: 'https://x.dev' }] } }, /containing `\{prompt\}`/],
    [{ ai: { markdownFile: '/index.md' } }, /relative filename/],
    [{ minWords: -1 }, /non-negative/],
  ])('rejects invalid options %#', (options, message) => {
    expect(() => resolveOptions(options as never)).toThrow(message);
  });

  it('borrows providers and markdownFile from open-with-llm, dropping "Open in"', () => {
    const config = resolveOptions(
      {},
      {
        markdownFile: 'page.md',
        providers: [{ label: 'Open in Perplexity', url: 'https://p.ai/?q={prompt}' }],
      }
    );
    expect(config.ai.providers).toEqual([{ label: 'Perplexity', url: 'https://p.ai/?q={prompt}' }]);
    expect(config.ai.markdownFile).toBe('page.md');
  });

  it('prefers its own ai options over open-with-llm', () => {
    const config = resolveOptions(
      { ai: { providers: [], markdownFile: false } },
      { markdownFile: 'page.md', providers: [{ label: 'Open in X', url: 'https://x/?q={prompt}' }] }
    );
    expect(config.ai.providers).toEqual([]);
    expect(config.ai.markdownFile).toBe(false);
  });
});

describe('plugin', () => {
  it('registers the client module and injects its config', () => {
    const plugin = shareSelectionPlugin(context, { minWords: 5 });
    expect(plugin.getClientModules!()[0]).toMatch(/client[/\\]index\.js$/);
    expect(configFromTags(plugin).minWords).toBe(5);
  });

  it('does nothing when disabled', () => {
    const plugin = shareSelectionPlugin(context, { enabled: false });
    expect(plugin.getClientModules!()).toEqual([]);
    expect(plugin.injectHtmlTags!({ content: undefined })).toEqual({});
  });

  it('picks up open-with-llm once all content has loaded', async () => {
    const plugin = shareSelectionPlugin(context);
    await loadAll(plugin, {
      'docusaurus-plugin-open-with-llm': {
        default: {
          markdownFile: 'index.md',
          providers: [{ label: 'Open in Claude', url: 'https://claude.ai/new?q={prompt}' }],
        },
      },
    });
    const config = configFromTags(plugin);
    expect(config.ai.markdownFile).toBe('index.md');
    expect(config.ai.providers).toEqual([
      { label: 'Claude', url: 'https://claude.ai/new?q={prompt}' },
    ]);
  });

  it('ignores open-with-llm when it is disabled', async () => {
    const plugin = shareSelectionPlugin(context);
    await loadAll(plugin, { 'docusaurus-plugin-open-with-llm': { default: undefined } });
    expect(configFromTags(plugin).ai.markdownFile).toBe(false);
  });

  it('validates options at startup', () => {
    expect(() => shareSelectionPlugin(context, { actions: ['nope' as never] })).toThrow(
      /unknown action/
    );
  });
});

describe('serializeConfig', () => {
  it('cannot close the script element early', () => {
    const config = resolveOptions({ ai: { prompt: '</script><script>alert(1)</script>' } });
    expect(serializeConfig(config)).not.toContain('</script>');
    expect(JSON.parse(serializeConfig(config)).ai.prompt).toBe(config.ai.prompt);
  });
});
