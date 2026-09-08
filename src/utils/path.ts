import * as path from 'node:path';

export class PathValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathValidationError';
  }
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F]/;

/**
 * Validates a user-supplied output path and returns a normalized,
 * workspace-relative POSIX-style path.
 *
 * Rejects absolute paths, drive letters, UNC paths, backslashes, control
 * characters, parent traversal, `.git` components, and non-`.svg` targets.
 * This is a pure string check; filesystem-level symlink checks happen at
 * write time.
 */
export function validateOutputPath(raw: string): string {
  const value = raw.trim();
  if (value.length === 0) {
    throw new PathValidationError('Output path must not be empty.');
  }
  if (value.length > 400) {
    throw new PathValidationError('Output path is too long (max 400 chars).');
  }
  if (CONTROL_CHARS.test(value)) {
    throw new PathValidationError('Output path contains control characters.');
  }
  if (value.includes('\\')) {
    throw new PathValidationError(
      'Output path must use forward slashes, not backslashes.',
    );
  }
  if (value.includes('\0')) {
    throw new PathValidationError('Output path contains a null byte.');
  }
  if (path.posix.isAbsolute(value) || /^[a-zA-Z]:/.test(value)) {
    throw new PathValidationError('Output path must be relative.');
  }
  if (value.startsWith('//')) {
    throw new PathValidationError('Output path must not be a UNC path.');
  }
  if (!value.toLowerCase().endsWith('.svg')) {
    throw new PathValidationError('Output path must end with ".svg".');
  }

  const segments = value.split('/').filter((s) => s.length > 0);
  for (const segment of segments) {
    if (segment === '..') {
      throw new PathValidationError('Output path must not traverse upward.');
    }
    if (segment === '.git') {
      throw new PathValidationError('Output path must not target ".git".');
    }
  }

  const normalized = path.posix.normalize(value);
  if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
    throw new PathValidationError('Output path escapes the workspace.');
  }
  return normalized;
}

/** The pair of theme-specific paths derived from a single `output` value. */
export interface DualOutputPaths {
  readonly light: string;
  readonly dark: string;
}

/**
 * Derives the fixed light/dark output paths from a single `output` value by
 * inserting a `-light` / `-dark` suffix before the extension, preserving the
 * extension's original case (`Chart.SVG` -> `Chart-light.SVG`).
 *
 * Both derived paths are re-validated with {@link validateOutputPath} and
 * asserted to be distinct (case-insensitively), so a caller can never write
 * two themes to the same file.
 */
export function deriveDualPaths(raw: string): DualOutputPaths {
  const normalized = validateOutputPath(raw);
  const extensionIndex = normalized.lastIndexOf('.');
  if (extensionIndex <= 0) {
    throw new PathValidationError(
      'Output path must have a name before the ".svg" extension.',
    );
  }
  const stem = normalized.slice(0, extensionIndex);
  const extension = normalized.slice(extensionIndex);
  const base = stem.split('/').pop() ?? '';
  if (base.length === 0) {
    throw new PathValidationError(
      'Output path must have a file name before the ".svg" extension.',
    );
  }

  const light = validateOutputPath(`${stem}-light${extension}`);
  const dark = validateOutputPath(`${stem}-dark${extension}`);
  if (light.toLowerCase() === dark.toLowerCase()) {
    throw new PathValidationError(
      'Derived light and dark output paths must be distinct.',
    );
  }
  return { light, dark };
}
