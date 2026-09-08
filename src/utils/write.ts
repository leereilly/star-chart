import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { validateOutputPath } from './path.js';

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
export async function writeChartFile(
  outputPath: string,
  content: string,
  options: WriteOptions,
): Promise<WriteResult> {
  const [result] = await writeChartFiles(
    [{ path: outputPath, content }],
    options,
  );
  if (!result) {
    throw new Error('Write produced no result.');
  }
  return result;
}

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
export async function writeChartFiles(
  files: readonly ChartFile[],
  options: WriteOptions,
): Promise<WriteResult[]> {
  const syncFs = options.fsImpl ?? fs;
  const asyncFs = options.fspImpl ?? fsp;

  if (files.length === 0) {
    return [];
  }

  const workspaceReal = syncFs.realpathSync(options.workspace);

  // Preflight: validate and inspect every target before touching anything.
  const plans: PreparedWrite[] = [];
  const seen = new Map<string, string>();
  for (const file of files) {
    const plan = prepare(file, workspaceReal, syncFs);
    const key = plan.relativePath.toLowerCase();
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new Error(
        `Duplicate output path in the same run: "${plan.relativePath}" ` +
          `collides with "${previous}".`,
      );
    }
    seen.set(key, plan.relativePath);
    plans.push(plan);
  }

  const staged: StagedWrite[] = [];
  try {
    for (const plan of plans) {
      if (!plan.changed) {
        continue;
      }
      await asyncFs.mkdir(plan.dir, { recursive: true });
      const tempPath = path.join(
        plan.dir,
        `.star-chart-${process.pid}-${Date.now()}-${staged.length}.tmp`,
      );
      // Registered before the handle is opened so the cleanup pass below
      // removes the sibling even when the staging write itself fails.
      const entry: StagedWrite = { plan, tempPath, renamed: false };
      staged.push(entry);
      let handle: fsp.FileHandle | undefined;
      try {
        // wx = exclusive create; fail if it already exists.
        handle = await asyncFs.open(tempPath, 'wx', 0o644);
        await handle.writeFile(plan.nextBytes);
        await handle.close();
        handle = undefined;
      } finally {
        if (handle) {
          try {
            await handle.close();
          } catch (closeError) {
            // Never mask the write failure that brought us here.
            process.emitWarning(
              `Could not close temporary file ${tempPath}: ` +
                describeError(closeError),
            );
          }
        }
      }
    }

    const renamed: StagedWrite[] = [];
    for (const entry of staged) {
      // Revalidate containment of the temp file before renaming.
      const tempReal = syncFs.realpathSync(path.dirname(entry.tempPath));
      if (
        !containedIn(
          path.join(tempReal, path.basename(entry.tempPath)),
          workspaceReal,
        )
      ) {
        throw new Error('Temp file escaped the workspace during write.');
      }
      try {
        await asyncFs.rename(entry.tempPath, entry.plan.absolutePath);
      } catch (error) {
        throw await rollback(renamed, error, asyncFs);
      }
      entry.renamed = true;
      renamed.push(entry);
    }
  } finally {
    // Remove any temp file that was never renamed into place.
    for (const entry of staged) {
      if (entry.renamed) {
        continue;
      }
      try {
        await asyncFs.rm(entry.tempPath, { force: true });
      } catch (cleanupError) {
        // The batch has already succeeded or failed on its own merits; a
        // leftover temp sibling is reported, never escalated into the result.
        process.emitWarning(
          `Could not remove temporary file ${entry.tempPath}: ` +
            describeError(cleanupError),
        );
      }
    }
  }

  return plans.map((plan) => ({
    absolutePath: plan.absolutePath,
    relativePath: plan.relativePath,
    changed: plan.changed,
  }));
}

interface PreparedWrite {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly dir: string;
  readonly nextBytes: Buffer;
  readonly existingBytes: Buffer | undefined;
  readonly changed: boolean;
}

interface StagedWrite {
  readonly plan: PreparedWrite;
  readonly tempPath: string;
  renamed: boolean;
}

function prepare(
  file: ChartFile,
  workspaceReal: string,
  syncFs: typeof fs,
): PreparedWrite {
  const relativePath = validateOutputPath(file.path);
  const absoluteTarget = path.resolve(workspaceReal, relativePath);

  if (!containedIn(absoluteTarget, workspaceReal)) {
    throw new Error('Resolved output path escapes the workspace root.');
  }

  // Inspect each existing ancestor component for symlinks / non-directories.
  const dir = path.dirname(absoluteTarget);
  const relDir = path.relative(workspaceReal, dir);
  const dirSegments = relDir.length > 0 ? relDir.split(path.sep) : [];
  let cursor = workspaceReal;
  for (const segment of dirSegments) {
    cursor = path.join(cursor, segment);
    let stat: fs.Stats | undefined;
    try {
      stat = syncFs.lstatSync(cursor);
    } catch {
      stat = undefined;
    }
    if (stat) {
      if (stat.isSymbolicLink()) {
        throw new Error(
          `Refusing to write through symlinked directory: ${cursor}`,
        );
      }
      if (!stat.isDirectory()) {
        throw new Error(`Output parent is not a directory: ${cursor}`);
      }
    }
  }

  // Inspect the target itself if it exists.
  let existingBytes: Buffer | undefined;
  try {
    const targetStat = syncFs.lstatSync(absoluteTarget);
    if (targetStat.isSymbolicLink()) {
      throw new Error(
        `Refusing to overwrite a symlinked output file: ${absoluteTarget}`,
      );
    }
    if (!targetStat.isFile()) {
      throw new Error(
        `Output target exists but is not a regular file: ${absoluteTarget}`,
      );
    }
    existingBytes = syncFs.readFileSync(absoluteTarget);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      existingBytes = undefined;
    } else if (error instanceof Error && error.message.startsWith('Refusing')) {
      throw error;
    } else if (
      error instanceof Error &&
      error.message.startsWith('Output target')
    ) {
      throw error;
    } else {
      existingBytes = undefined;
    }
  }

  const nextBytes = Buffer.from(file.content, 'utf8');
  const changed = !existingBytes || !existingBytes.equals(nextBytes);

  return {
    absolutePath: absoluteTarget,
    relativePath,
    dir,
    nextBytes,
    existingBytes,
    changed,
  };
}

/**
 * Best-effort restoration of already-renamed targets. Returns the error to
 * throw: the original failure, annotated with any rollback problems.
 */
async function rollback(
  renamed: readonly StagedWrite[],
  cause: unknown,
  asyncFs: typeof fsp,
): Promise<Error> {
  const problems: string[] = [];
  for (const entry of [...renamed].reverse()) {
    const { plan } = entry;
    try {
      if (plan.existingBytes) {
        await asyncFs.writeFile(plan.absolutePath, plan.existingBytes);
      } else {
        await asyncFs.rm(plan.absolutePath, { force: true });
      }
    } catch (rollbackError) {
      problems.push(`${plan.relativePath}: ${describeError(rollbackError)}`);
    }
  }

  const base = describeError(cause);
  const message =
    problems.length === 0
      ? `Failed to write chart files: ${base}`
      : `Failed to write chart files: ${base}. Rollback also failed for ` +
        `${problems.join('; ')}.`;
  return new Error(message, { cause });
}

function containedIn(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface NodeError extends Error {
  code?: string;
}

function isNodeError(error: unknown): error is NodeError {
  return (
    error instanceof Error && typeof (error as NodeError).code === 'string'
  );
}
