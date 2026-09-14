/** Minimal, safe SVG string construction with strict XML escaping. */
/** Removes XML-invalid control characters. */
export declare function stripControls(value: string): string;
/** Escapes text content for safe inclusion between XML tags. */
export declare function escapeText(value: string): string;
/** Escapes a value for use inside a double-quoted XML attribute. */
export declare function escapeAttr(value: string): string;
export type AttrValue = string | number | boolean | null | undefined;
/** Builds an attribute string; skips null/undefined/false values. */
export declare function attrs(map: Record<string, AttrValue>): string;
/** Opens an element tag with attributes (no self-close). */
export declare function open(tag: string, map?: Record<string, AttrValue>): string;
/** A self-closed element. */
export declare function selfClosed(tag: string, map?: Record<string, AttrValue>): string;
/** An element with escaped text content. */
export declare function textElement(tag: string, content: string, map?: Record<string, AttrValue>): string;
/** Wraps children in an element. */
export declare function element(tag: string, map: Record<string, AttrValue>, children: string): string;
/** Deterministic id factory scoped by a prefix. */
export declare function idFactory(prefix: string): (name: string) => string;
