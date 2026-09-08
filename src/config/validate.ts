import type { RepositoryRef } from '../models/index.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Parses a strict boolean input. */
export function parseBoolean(
  name: string,
  raw: string | undefined,
  fallback: boolean,
): boolean {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = raw.trim().toLowerCase();
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new ConfigError(
    `Input "${name}" must be "true" or "false" (got "${raw}").`,
  );
}

/** Parses a bounded integer input. */
export function parseInteger(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new ConfigError(`Input "${name}" must be an integer (got "${raw}").`);
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(value)) {
    throw new ConfigError(`Input "${name}" is out of range.`);
  }
  if (value < min || value > max) {
    throw new ConfigError(
      `Input "${name}" must be between ${min} and ${max} (got ${value}).`,
    );
  }
  return value;
}

/** Parses an optional bounded integer (empty -> null). */
export function parseOptionalInteger(
  name: string,
  raw: string | undefined,
  min: number,
  max: number,
): number | null {
  if (raw === undefined || raw.trim() === '' || raw.trim() === 'auto') {
    return null;
  }
  return parseInteger(name, raw, min, min, max);
}

/** Parses a duration in seconds, accepting an optional trailing "s"/"ms". */
export function parseSeconds(
  name: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const trimmed = raw.trim().toLowerCase();
  const msMatch = /^(\d+(?:\.\d+)?)ms$/.exec(trimmed);
  const sMatch = /^(\d+(?:\.\d+)?)s?$/.exec(trimmed);
  let seconds: number;
  if (msMatch) {
    seconds = Number.parseFloat(msMatch[1] ?? '') / 1000;
  } else if (sMatch) {
    seconds = Number.parseFloat(sMatch[1] ?? '');
  } else {
    throw new ConfigError(
      `Input "${name}" must be a duration like "4s" or "500ms" (got "${raw}").`,
    );
  }
  if (!Number.isFinite(seconds)) {
    throw new ConfigError(`Input "${name}" is not a finite duration.`);
  }
  if (seconds < min || seconds > max) {
    throw new ConfigError(
      `Input "${name}" must be between ${min}s and ${max}s (got ${seconds}s).`,
    );
  }
  return seconds;
}

/** Parses a strict enum input. */
export function parseEnum<T extends string>(
  name: string,
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = raw.trim().toLowerCase() as T;
  if (!allowed.includes(value)) {
    throw new ConfigError(
      `Input "${name}" must be one of: ${allowed.join(', ')} (got "${raw}").`,
    );
  }
  return value;
}

const HEX_COLOR =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Validates a hexadecimal colour. Rejects CSS functions, urls, variables. */
export function parseColor(name: string, raw: string): string {
  const value = raw.trim();
  if (!HEX_COLOR.test(value)) {
    throw new ConfigError(
      `Input "${name}" must be a hex colour like "#40c463" (got "${raw}").`,
    );
  }
  return value.toLowerCase();
}

/** Validates a background colour, additionally allowing `transparent`. */
export function parseBackground(name: string, raw: string | undefined): string {
  if (raw === undefined || raw.trim() === '') {
    return 'transparent';
  }
  const value = raw.trim().toLowerCase();
  if (value === 'transparent' || value === 'none') {
    return 'transparent';
  }
  return parseColor(name, raw);
}

const FONT_TOKEN = /^[A-Za-z0-9 _-]+$/;

/**
 * Validates a CSS font-family list. Accepts comma-separated family names,
 * optionally quoted, and rejects CSS syntax, urls, and control characters.
 */
export function parseFontFamily(
  name: string,
  raw: string | undefined,
  fallback: string,
): string {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = raw.trim();
  if (value.length > 200) {
    throw new ConfigError(`Input "${name}" is too long (max 200 chars).`);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F;{}()<>\\]/.test(value)) {
    throw new ConfigError(`Input "${name}" contains invalid characters.`);
  }
  const families = value.split(',').map((f) => f.trim());
  const cleaned: string[] = [];
  for (const family of families) {
    if (family.length === 0) {
      throw new ConfigError(`Input "${name}" has an empty family name.`);
    }
    const quoted =
      (family.startsWith('"') && family.endsWith('"')) ||
      (family.startsWith("'") && family.endsWith("'"));
    const inner = quoted ? family.slice(1, -1) : family;
    if (!FONT_TOKEN.test(inner)) {
      throw new ConfigError(
        `Input "${name}" has an invalid family name: "${family}".`,
      );
    }
    // Re-quote names that contain spaces for safe CSS output.
    cleaned.push(inner.includes(' ') ? `"${inner}"` : inner);
  }
  return cleaned.join(', ');
}

/** Validates a repository "owner/repo" string. */
export function parseRepository(raw: string | undefined): RepositoryRef {
  const value = (raw ?? '').trim();
  if (value.length === 0) {
    throw new ConfigError(
      'A repository is required (set "repository" or run inside a repo).',
    );
  }
  if (/[\s]/.test(value) || value.includes('://') || value.includes('@')) {
    throw new ConfigError(
      `Repository must be "owner/repo", not a URL (got "${raw}").`,
    );
  }
  const parts = value.split('/');
  if (parts.length !== 2) {
    throw new ConfigError(`Repository must be "owner/repo" (got "${raw}").`);
  }
  const [owner, repo] = parts;
  const namePattern = /^[A-Za-z0-9._-]+$/;
  if (!owner || !namePattern.test(owner)) {
    throw new ConfigError(`Repository owner is invalid (got "${raw}").`);
  }
  if (!repo || !namePattern.test(repo) || repo === '.' || repo === '..') {
    throw new ConfigError(`Repository name is invalid (got "${raw}").`);
  }
  return { owner, repo };
}

export interface ParseRepositoriesOptions {
  /** Maximum accepted list length. */
  readonly max?: number;
  /** Collects non-fatal warnings (duplicates). */
  readonly warn?: (message: string) => void;
}

/**
 * Parses a comma- and/or newline-separated `repositories` list.
 *
 * Entries are trimmed, blanks are dropped, each remaining entry is validated
 * with the same rules as {@link parseRepository}, and duplicates are removed
 * case-insensitively while preserving the first spelling and order. A blank
 * input yields an empty list, which callers treat as "use `repository`".
 */
export function parseRepositories(
  raw: string | undefined,
  options: ParseRepositoriesOptions = {},
): RepositoryRef[] {
  const warn = options.warn ?? ((): void => undefined);
  const max = options.max ?? 20;
  const value = raw ?? '';
  if (value.trim() === '') {
    return [];
  }

  const entries = value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) {
    return [];
  }

  const seen = new Map<string, string>();
  const parsed: RepositoryRef[] = [];
  const duplicates: string[] = [];

  for (const entry of entries) {
    const repository = parseRepository(entry);
    const key = `${repository.owner}/${repository.repo}`.toLowerCase();
    const first = seen.get(key);
    if (first !== undefined) {
      duplicates.push(entry);
      continue;
    }
    seen.set(key, entry);
    parsed.push(repository);
  }

  if (duplicates.length > 0) {
    warn(
      `Input "repositories" contains duplicate entries that were ignored: ` +
        `${duplicates.join(', ')}.`,
    );
  }

  if (parsed.length > max) {
    throw new ConfigError(
      `Input "repositories" accepts at most ${max} repositories ` +
        `(got ${parsed.length}).`,
    );
  }

  return parsed;
}

/** Validates a plain-text title. */
export function parseTitle(raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  const value = raw.trim();
  if (value.length > 200) {
    throw new ConfigError('Input "title" is too long (max 200 chars).');
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
    throw new ConfigError('Input "title" contains control characters.');
  }
  return value;
}
