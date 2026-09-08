import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
export interface WriteResult {
    /** Absolute path written (or that would have been written). */
    readonly absolutePath: string;
    /** Workspace-relative normalized path. */
    readonly relativePath: string;
    /** True when the file content changed (a write occurred). */
    readonly changed: boolean;
}
export interface WriteOptions {
    /** Absolute workspace root that the output must remain within. */
    readonly workspace: string;
    /** Injected fs module (for testing). */
    readonly fsImpl?: typeof fs | undefined;
    readonly fspImpl?: typeof fsp | undefined;
}
/** One file in a batch write. */
export interface ChartFile {
    /** Workspace-relative `.svg` path. */
    readonly path: string;
    readonly content: string;
}
/**
 * Writes `content` to a validated, workspace-relative `.svg` path with
 * symlink-safe, atomic semantics:
 *
 *  - reject traversal / absolute / symlinked components,
 *  - skip the write when bytes are unchanged,
 *  - write an exclusive no-follow temp sibling and atomically rename.
 */
export declare function writeChartFile(outputPath: string, content: string, options: WriteOptions): Promise<WriteResult>;
/**
 * Writes several charts as one unit, applying the guarantees of
 * {@link writeChartFile} across the whole batch:
 *
 *  - every path is validated and every target inspected **before** any final
 *    rename, so a rejected path never leaves a half-written set behind,
 *  - duplicate normalized targets (compared case-insensitively) are rejected,
 *  - all changed files are staged as temp siblings first and only then renamed
 *    into place,
 *  - if a later rename fails, earlier renames are rolled back to their prior
 *    contents (or removed when they did not previously exist) and any rollback
 *    failure is reported alongside the original error rather than swallowed.
 */
export declare function writeChartFiles(files: readonly ChartFile[], options: WriteOptions): Promise<WriteResult[]>;
