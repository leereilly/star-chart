/** Minimal, safe SVG string construction with strict XML escaping. */

// Control characters that are invalid in XML 1.0 (except tab, LF, CR).
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Removes XML-invalid control characters. */
export function stripControls(value: string): string {
  return value.replace(INVALID_XML_CHARS, '');
}

/** Escapes text content for safe inclusion between XML tags. */
export function escapeText(value: string): string {
  return stripControls(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escapes a value for use inside a double-quoted XML attribute. */
export function escapeAttr(value: string): string {
  return stripControls(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type AttrValue = string | number | boolean | null | undefined;

/** Builds an attribute string; skips null/undefined/false values. */
export function attrs(map: Record<string, AttrValue>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === null || value === undefined || value === false) {
      continue;
    }
    if (value === true) {
      parts.push(key);
      continue;
    }
    parts.push(`${key}="${escapeAttr(String(value))}"`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

/** Opens an element tag with attributes (no self-close). */
export function open(tag: string, map: Record<string, AttrValue> = {}): string {
  return `<${tag}${attrs(map)}>`;
}

/** A self-closed element. */
export function selfClosed(
  tag: string,
  map: Record<string, AttrValue> = {},
): string {
  return `<${tag}${attrs(map)}/>`;
}

/** An element with escaped text content. */
export function textElement(
  tag: string,
  content: string,
  map: Record<string, AttrValue> = {},
): string {
  return `<${tag}${attrs(map)}>${escapeText(content)}</${tag}>`;
}

/** Wraps children in an element. */
export function element(
  tag: string,
  map: Record<string, AttrValue>,
  children: string,
): string {
  return `<${tag}${attrs(map)}>${children}</${tag}>`;
}

/** Deterministic id factory scoped by a prefix. */
export function idFactory(prefix: string): (name: string) => string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  return (name: string): string =>
    `${safePrefix}-${name.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
