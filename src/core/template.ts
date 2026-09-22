const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Fills `{name}` placeholders. A line whose placeholders all resolve to empty
 * strings is dropped, so optional values don't leave dangling labels behind.
 * Unknown placeholders are left as written.
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  const lines = template.split('\n').flatMap(line => {
    const names = [...line.matchAll(PLACEHOLDER)]
      .map(match => match[1])
      .filter(name => name in values);
    if (names.length > 0 && names.every(name => !values[name])) return [];
    return [
      line.replace(PLACEHOLDER, (token, name: string) => (name in values ? values[name] : token)),
    ];
  });
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Same as `renderTemplate`, but every value is URL-encoded. Used for share and action URLs. */
export function renderUrlTemplate(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (token, name: string) =>
    name in values ? encodeURIComponent(values[name]) : token
  );
}
