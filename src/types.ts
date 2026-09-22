export type BuiltInActionId =
  'copy' | 'markdown' | 'ai' | 'share' | 'teams' | 'linkedin' | 'x' | 'bluesky';

/** Relabel a built-in action. */
export interface BuiltInActionOptions {
  action: BuiltInActionId;
  label?: string;
}

/**
 * Open a URL built from the selection. Placeholders are URL-encoded:
 * `{text}`, `{shortText}`, `{url}`, `{title}`, `{section}`, `{quote}`.
 */
export interface CustomActionOptions {
  label: string;
  url: string;
}

export type ActionOptions = BuiltInActionId | BuiltInActionOptions | CustomActionOptions;

export interface ProviderOptions {
  /** Button label. "Open in " prefixes are dropped to keep the palette compact. */
  label: string;
  /** URL containing `{prompt}`, replaced with the encoded prompt. */
  url: string;
}

export interface AiOptions {
  /**
   * Prompt template. Placeholders: `{title}`, `{section}`, `{url}`, `{markdownUrl}`,
   * `{selection}`, `{context}`. Lines whose placeholders are all empty are dropped.
   */
  prompt?: string;
  /** Providers opened with the prompt. Defaults to open-with-llm's providers, then ChatGPT and Claude. */
  providers?: ProviderOptions[];
  /** Markdown filename appended to docs routes for `{markdownUrl}`. Defaults to open-with-llm's `markdownFile`. */
  markdownFile?: string | false;
  /** Longest provider URL to open before trimming context from the prompt. @default 6000 */
  maxUrlLength?: number;
}

export interface ShareSelectionOptions {
  /** Turn the palette off without removing the plugin. @default true */
  enabled?: boolean;
  /** Palette buttons, in order. @default ['copy', 'ai', 'share'] */
  actions?: ActionOptions[];
  /** Where selections count. @default '.markdown' */
  contentSelector?: string;
  /** Selections inside these are ignored. @default 'pre, code, .hash-link, button, input, textarea' */
  excludeSelector?: string;
  /** Shortest selection, in words, that shows the palette. @default 3 */
  minWords?: number;
  /** Characters of surrounding text captured either side of the selection. @default 600 */
  contextChars?: number;
  /** Add a text fragment (`#:~:text=`) so links scroll to and highlight the passage. @default true */
  textFragments?: boolean;
  ai?: AiOptions;
}

export type ResolvedAction =
  | { kind: 'builtin'; id: BuiltInActionId; label: string }
  | { kind: 'custom'; label: string; url: string };

export interface ResolvedAiOptions {
  prompt: string;
  providers: ProviderOptions[];
  markdownFile: string | false;
  maxUrlLength: number;
}

/** Serialised into the page and read by the client module. */
export interface ClientConfig {
  actions: ResolvedAction[];
  contentSelector: string;
  excludeSelector: string;
  minWords: number;
  contextChars: number;
  textFragments: boolean;
  ai: ResolvedAiOptions;
}
