import { PLUGIN_NAME } from './constants';
import type {
  ActionOptions,
  BuiltInActionId,
  ClientConfig,
  ProviderOptions,
  ResolvedAction,
  ShareSelectionOptions,
} from './types';

export { PLUGIN_NAME };

export const BUILT_IN_LABELS: Record<BuiltInActionId, string> = {
  copy: 'Copy',
  markdown: 'Copy Markdown',
  ai: 'Ask AI',
  share: 'Share',
  teams: 'Teams',
  linkedin: 'LinkedIn',
  x: 'X',
  bluesky: 'Bluesky',
};

export const DEFAULT_PROVIDERS: ProviderOptions[] = [
  { label: 'ChatGPT', url: 'https://chatgpt.com/?q={prompt}' },
  { label: 'Claude', url: 'https://claude.ai/new?q={prompt}' },
];

export const DEFAULT_PROMPT = `I'm reading "{title}" and want help with a passage from it.
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

Help me understand this passage.`;

/** The slice of docusaurus-plugin-open-with-llm's resolved options this plugin reuses. */
export interface OpenWithLlmContent {
  markdownFile?: string;
  providers?: ProviderOptions[];
}

export class ShareSelectionOptionsError extends Error {
  constructor(message: string) {
    super(`[${PLUGIN_NAME}] ${message}`);
    this.name = 'ShareSelectionOptionsError';
  }
}

function isBuiltIn(id: unknown): id is BuiltInActionId {
  return typeof id === 'string' && id in BUILT_IN_LABELS;
}

function resolveAction(action: ActionOptions): ResolvedAction {
  if (typeof action === 'string') {
    if (!isBuiltIn(action)) {
      throw new ShareSelectionOptionsError(
        `unknown action "${action}". Use one of ${Object.keys(BUILT_IN_LABELS).join(', ')}, or { label, url }`
      );
    }
    return { kind: 'builtin', id: action, label: BUILT_IN_LABELS[action] };
  }
  if ('action' in action) {
    if (!isBuiltIn(action.action)) {
      throw new ShareSelectionOptionsError(`unknown action "${String(action.action)}"`);
    }
    return {
      kind: 'builtin',
      id: action.action,
      label: action.label || BUILT_IN_LABELS[action.action],
    };
  }
  if (!action.label || !action.url) {
    throw new ShareSelectionOptionsError('custom actions need a `label` and a `url`');
  }
  return { kind: 'custom', label: action.label, url: action.url };
}

function shortProviderLabel(label: string): string {
  return label.replace(/^open in\s+/i, '');
}

function validateProviders(providers: ProviderOptions[]): ProviderOptions[] {
  for (const provider of providers) {
    if (!provider.label || !provider.url?.includes('{prompt}')) {
      throw new ShareSelectionOptionsError(
        'each AI provider needs a `label` and a `url` containing `{prompt}`'
      );
    }
  }
  return providers.map(provider => ({ ...provider, label: shortProviderLabel(provider.label) }));
}

function positiveNumber(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) {
    throw new ShareSelectionOptionsError(`\`${name}\` must be a non-negative number`);
  }
  return value;
}

/**
 * Resolves user options into the config shipped to the browser. When
 * docusaurus-plugin-open-with-llm is installed, its providers and Markdown
 * filename fill in anything this plugin's `ai` options leave unset.
 */
export function resolveOptions(
  options: ShareSelectionOptions = {},
  openWithLlm?: OpenWithLlmContent
): ClientConfig {
  const ai = options.ai ?? {};
  const actions = (options.actions ?? ['copy', 'ai', 'share']).map(resolveAction);
  const markdownFile = ai.markdownFile ?? openWithLlm?.markdownFile ?? false;

  if (markdownFile && markdownFile.startsWith('/')) {
    throw new ShareSelectionOptionsError('`ai.markdownFile` must be a relative filename');
  }

  return {
    actions,
    contentSelector: options.contentSelector ?? '.markdown',
    excludeSelector: options.excludeSelector ?? 'pre, code, .hash-link, button, input, textarea',
    minWords: positiveNumber(options.minWords, 3, 'minWords'),
    contextChars: positiveNumber(options.contextChars, 600, 'contextChars'),
    textFragments: options.textFragments ?? true,
    ai: {
      prompt: ai.prompt ?? DEFAULT_PROMPT,
      providers: validateProviders(ai.providers ?? openWithLlm?.providers ?? DEFAULT_PROVIDERS),
      markdownFile,
      maxUrlLength: positiveNumber(ai.maxUrlLength, 6000, 'ai.maxUrlLength'),
    },
  };
}
