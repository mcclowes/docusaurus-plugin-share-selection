import { fileURLToPath } from 'node:url';
import type { LoadContext, Plugin } from '@docusaurus/types';
import { CONFIG_ELEMENT_ID, PLUGIN_NAME } from './constants';
import { resolveOptions, type OpenWithLlmContent } from './options';
import type { ClientConfig, ShareSelectionOptions } from './types';

export { resolveOptions, ShareSelectionOptionsError, DEFAULT_PROMPT } from './options';
export type {
  ActionOptions,
  AiOptions,
  BuiltInActionId,
  BuiltInActionOptions,
  CustomActionOptions,
  ProviderOptions,
  ShareSelectionOptions,
} from './types';

export { ACTION_EVENT, CONFIG_ELEMENT_ID } from './constants';
const OPEN_WITH_LLM_PLUGIN = 'docusaurus-plugin-open-with-llm';

/** Safe to inline in a <script> element: `<` can't close the tag early. */
export function serializeConfig(config: ClientConfig): string {
  return JSON.stringify(config).replace(/</g, '\\u003c');
}

function findOpenWithLlmContent(
  allContent: Record<string, Record<string, unknown> | undefined>
): OpenWithLlmContent | undefined {
  const instances = allContent[OPEN_WITH_LLM_PLUGIN];
  if (!instances) return undefined;
  return (instances.default ?? Object.values(instances)[0]) as OpenWithLlmContent | undefined;
}

export default function shareSelectionPlugin(
  _context: LoadContext,
  options: ShareSelectionOptions = {}
): Plugin<undefined> {
  const enabled = options.enabled ?? true;
  // Resolving validates, so bad config fails at startup; re-resolved once other plugins have loaded.
  let config = resolveOptions(options);

  return {
    name: PLUGIN_NAME,

    async allContentLoaded({ allContent }) {
      const openWithLlm = findOpenWithLlmContent(
        allContent as Record<string, Record<string, unknown> | undefined>
      );
      if (openWithLlm) config = resolveOptions(options, openWithLlm);
    },

    getClientModules() {
      return enabled ? [fileURLToPath(new URL('./client/index.js', import.meta.url))] : [];
    },

    injectHtmlTags() {
      if (!enabled) return {};
      return {
        headTags: [
          {
            tagName: 'script',
            attributes: { type: 'application/json', id: CONFIG_ELEMENT_ID },
            innerHTML: serializeConfig(config),
          },
        ],
      };
    },
  };
}
