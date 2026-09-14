import type { RepositoryRef } from '../models/index.js';
export declare class ConfigError extends Error {
    constructor(message: string);
}
/** Parses a strict boolean input. */
export declare function parseBoolean(name: string, raw: string | undefined, fallback: boolean): boolean;
/** Parses a bounded integer input. */
export declare function parseInteger(name: string, raw: string | undefined, fallback: number, min: number, max: number): number;
/** Parses an optional bounded integer (empty -> null). */
export declare function parseOptionalInteger(name: string, raw: string | undefined, min: number, max: number): number | null;
/** Parses a duration in seconds, accepting an optional trailing "s"/"ms". */
export declare function parseSeconds(name: string, raw: string | undefined, fallback: number, min: number, max: number): number;
/** Parses a strict enum input. */
export declare function parseEnum<T extends string>(name: string, raw: string | undefined, allowed: readonly T[], fallback: T): T;
/** Validates a hexadecimal colour. Rejects CSS functions, urls, variables. */
export declare function parseColor(name: string, raw: string): string;
/** Validates a background colour, additionally allowing `transparent`. */
export declare function parseBackground(name: string, raw: string | undefined): string;
/**
 * Validates a CSS font-family list. Accepts comma-separated family names,
 * optionally quoted, and rejects CSS syntax, urls, and control characters.
 */
export declare function parseFontFamily(name: string, raw: string | undefined, fallback: string): string;
/** Validates a repository "owner/repo" string. */
export declare function parseRepository(raw: string | undefined): RepositoryRef;
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
export declare function parseRepositories(raw: string | undefined, options?: ParseRepositoriesOptions): RepositoryRef[];
/** Validates a plain-text title. */
export declare function parseTitle(raw: string | undefined): string | null;
