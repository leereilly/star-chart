export declare class PathValidationError extends Error {
    constructor(message: string);
}
/**
 * Validates a user-supplied output path and returns a normalized,
 * workspace-relative POSIX-style path.
 *
 * Rejects absolute paths, drive letters, UNC paths, backslashes, control
 * characters, parent traversal, `.git` components, and non-`.svg` targets.
 * This is a pure string check; filesystem-level symlink checks happen at
 * write time.
 */
export declare function validateOutputPath(raw: string): string;
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
export declare function deriveDualPaths(raw: string): DualOutputPaths;
