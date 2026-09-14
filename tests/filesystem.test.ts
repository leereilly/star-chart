import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeChartFile, writeChartFiles } from '../src/utils/write.js';
import {
  deriveDualPaths,
  validateOutputPath,
  PathValidationError,
} from '../src/utils/path.js';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { makeScratchDir } from './helpers/index.js';

describe('validateOutputPath', () => {
  it('accepts a clean relative svg path', () => {
    expect(validateOutputPath('assets/star-chart.svg')).toBe(
      'assets/star-chart.svg',
    );
  });

  it('rejects unsafe paths', () => {
    expect(() => validateOutputPath('/abs.svg')).toThrow(PathValidationError);
    expect(() => validateOutputPath('../up.svg')).toThrow(PathValidationError);
    expect(() => validateOutputPath('a\\b.svg')).toThrow(PathValidationError);
    expect(() => validateOutputPath('C:/x.svg')).toThrow(PathValidationError);
    expect(() => validateOutputPath('//unc/x.svg')).toThrow(
      PathValidationError,
    );
    expect(() => validateOutputPath('chart.png')).toThrow(PathValidationError);
    expect(() => validateOutputPath('.git/hooks/x.svg')).toThrow(
      PathValidationError,
    );
  });
});

describe('writeChartFile', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = makeScratchDir('fs-');
  });
  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('writes atomically and creates directories', async () => {
    const result = await writeChartFile('assets/chart.svg', '<svg/>', {
      workspace,
    });
    expect(result.changed).toBe(true);
    expect(fs.readFileSync(result.absolutePath, 'utf8')).toBe('<svg/>');
    expect(result.relativePath).toBe('assets/chart.svg');
  });

  it('skips unchanged writes', async () => {
    await writeChartFile('c.svg', 'same', { workspace });
    const stat1 = fs.statSync(path.join(workspace, 'c.svg'));
    await new Promise((r) => setTimeout(r, 10));
    const result = await writeChartFile('c.svg', 'same', { workspace });
    expect(result.changed).toBe(false);
    const stat2 = fs.statSync(path.join(workspace, 'c.svg'));
    expect(stat2.mtimeMs).toBe(stat1.mtimeMs);
  });

  it('overwrites when content changes', async () => {
    await writeChartFile('c.svg', 'a', { workspace });
    const result = await writeChartFile('c.svg', 'b', { workspace });
    expect(result.changed).toBe(true);
    expect(fs.readFileSync(path.join(workspace, 'c.svg'), 'utf8')).toBe('b');
  });

  const skipSymlink = process.platform === 'win32';

  it.skipIf(skipSymlink)(
    'refuses to write through a symlinked directory',
    async () => {
      const outside = makeScratchDir('out-');
      fs.symlinkSync(outside, path.join(workspace, 'linked'));
      await expect(
        writeChartFile('linked/chart.svg', '<svg/>', { workspace }),
      ).rejects.toThrow(/symlink/i);
      fs.rmSync(outside, { recursive: true, force: true });
    },
  );

  it.skipIf(skipSymlink)('refuses to overwrite a symlinked file', async () => {
    const target = path.join(workspace, 'real.svg');
    fs.writeFileSync(target, 'real');
    fs.symlinkSync(target, path.join(workspace, 'link.svg'));
    await expect(
      writeChartFile('link.svg', 'new', { workspace }),
    ).rejects.toThrow(/symlink/i);
  });

  it('rejects traversal at write time', async () => {
    await expect(
      writeChartFile('../escape.svg', '<svg/>', { workspace }),
    ).rejects.toThrow();
  });
});

describe('deriveDualPaths', () => {
  it('inserts theme suffixes before the extension', () => {
    expect(deriveDualPaths('assets/star-chart.svg')).toEqual({
      light: 'assets/star-chart-light.svg',
      dark: 'assets/star-chart-dark.svg',
    });
    expect(deriveDualPaths('chart.svg')).toEqual({
      light: 'chart-light.svg',
      dark: 'chart-dark.svg',
    });
  });

  it('preserves the extension case', () => {
    expect(deriveDualPaths('a/Chart.SVG')).toEqual({
      light: 'a/Chart-light.SVG',
      dark: 'a/Chart-dark.SVG',
    });
  });

  it('normalizes and revalidates the derived paths', () => {
    expect(deriveDualPaths('./a//b/c.svg').light).toBe('a/b/c-light.svg');
    expect(() => deriveDualPaths('../x.svg')).toThrow(PathValidationError);
    expect(() => deriveDualPaths('x.png')).toThrow(PathValidationError);
    expect(() => deriveDualPaths('.svg')).toThrow(PathValidationError);
    expect(() => deriveDualPaths('a/.svg')).toThrow(PathValidationError);
  });

  it('always yields distinct paths', () => {
    const { light, dark } = deriveDualPaths('assets/x.svg');
    expect(light.toLowerCase()).not.toBe(dark.toLowerCase());
  });
});

describe('writeChartFiles', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = makeScratchDir('fs-multi-');
  });
  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('writes every file and reports each result', async () => {
    const results = await writeChartFiles(
      [
        { path: 'assets/a-light.svg', content: '<svg>light</svg>' },
        { path: 'assets/a-dark.svg', content: '<svg>dark</svg>' },
      ],
      { workspace },
    );
    expect(results.map((r) => r.relativePath)).toEqual([
      'assets/a-light.svg',
      'assets/a-dark.svg',
    ]);
    expect(results.every((r) => r.changed)).toBe(true);
    expect(
      fs.readFileSync(path.join(workspace, 'assets/a-light.svg'), 'utf8'),
    ).toBe('<svg>light</svg>');
    expect(
      fs.readFileSync(path.join(workspace, 'assets/a-dark.svg'), 'utf8'),
    ).toBe('<svg>dark</svg>');
  });

  it('reports unchanged files without rewriting them', async () => {
    const files = [
      { path: 'a.svg', content: 'one' },
      { path: 'b.svg', content: 'two' },
    ];
    await writeChartFiles(files, { workspace });
    const before = fs.statSync(path.join(workspace, 'a.svg')).mtimeMs;
    await new Promise((r) => setTimeout(r, 10));
    const results = await writeChartFiles(
      [files[0]!, { path: 'b.svg', content: 'changed' }],
      { workspace },
    );
    expect(results[0]?.changed).toBe(false);
    expect(results[1]?.changed).toBe(true);
    expect(fs.statSync(path.join(workspace, 'a.svg')).mtimeMs).toBe(before);
    expect(fs.readFileSync(path.join(workspace, 'b.svg'), 'utf8')).toBe(
      'changed',
    );
  });

  it('rejects duplicate normalized paths case-insensitively', async () => {
    await expect(
      writeChartFiles(
        [
          { path: 'assets/x.svg', content: 'a' },
          { path: './assets/X.SVG', content: 'b' },
        ],
        { workspace },
      ),
    ).rejects.toThrow(/duplicate/i);
    expect(fs.existsSync(path.join(workspace, 'assets/x.svg'))).toBe(false);
  });

  it('writes nothing when any path fails preflight', async () => {
    await expect(
      writeChartFiles(
        [
          { path: 'good.svg', content: 'good' },
          { path: '../escape.svg', content: 'bad' },
        ],
        { workspace },
      ),
    ).rejects.toThrow();
    expect(fs.existsSync(path.join(workspace, 'good.svg'))).toBe(false);
  });

  it('rolls back earlier renames when a later rename fails', async () => {
    fs.writeFileSync(path.join(workspace, 'first.svg'), 'original');
    let renames = 0;
    const fspImpl = {
      ...fsp,
      rename: async (from: fs.PathLike, to: fs.PathLike) => {
        renames += 1;
        if (renames === 2) {
          throw new Error('simulated rename failure');
        }
        await fsp.rename(from, to);
      },
    } as unknown as typeof fsp;

    await expect(
      writeChartFiles(
        [
          { path: 'first.svg', content: 'updated' },
          { path: 'second.svg', content: 'new' },
        ],
        { workspace, fspImpl },
      ),
    ).rejects.toThrow(/simulated rename failure/);

    expect(fs.readFileSync(path.join(workspace, 'first.svg'), 'utf8')).toBe(
      'original',
    );
    expect(fs.existsSync(path.join(workspace, 'second.svg'))).toBe(false);
    // No temp siblings left behind.
    expect(fs.readdirSync(workspace).sort()).toEqual(['first.svg']);
  });

  it('removes a rolled-back file that did not previously exist', async () => {
    let renames = 0;
    const fspImpl = {
      ...fsp,
      rename: async (from: fs.PathLike, to: fs.PathLike) => {
        renames += 1;
        if (renames === 2) {
          throw new Error('boom');
        }
        await fsp.rename(from, to);
      },
    } as unknown as typeof fsp;

    await expect(
      writeChartFiles(
        [
          { path: 'one.svg', content: 'a' },
          { path: 'two.svg', content: 'b' },
        ],
        { workspace, fspImpl },
      ),
    ).rejects.toThrow(/boom/);
    expect(fs.existsSync(path.join(workspace, 'one.svg'))).toBe(false);
    expect(fs.existsSync(path.join(workspace, 'two.svg'))).toBe(false);
  });

  it('reports rollback failures alongside the original error', async () => {
    fs.writeFileSync(path.join(workspace, 'first.svg'), 'original');
    let renames = 0;
    const fspImpl = {
      ...fsp,
      rename: async (from: fs.PathLike, to: fs.PathLike) => {
        renames += 1;
        if (renames === 2) {
          throw new Error('rename exploded');
        }
        await fsp.rename(from, to);
      },
      writeFile: async () => {
        throw new Error('restore denied');
      },
    } as unknown as typeof fsp;

    await expect(
      writeChartFiles(
        [
          { path: 'first.svg', content: 'updated' },
          { path: 'second.svg', content: 'new' },
        ],
        { workspace, fspImpl },
      ),
    ).rejects.toThrow(/rename exploded[\s\S]*Rollback also failed/);
  });

  it('preserves symlink protection across the batch', async () => {
    if (process.platform === 'win32') {
      return;
    }
    const target = path.join(workspace, 'real.svg');
    fs.writeFileSync(target, 'real');
    fs.symlinkSync(target, path.join(workspace, 'link.svg'));
    await expect(
      writeChartFiles(
        [
          { path: 'safe.svg', content: 'a' },
          { path: 'link.svg', content: 'b' },
        ],
        { workspace },
      ),
    ).rejects.toThrow(/symlink/i);
    expect(fs.existsSync(path.join(workspace, 'safe.svg'))).toBe(false);
  });

  it('leaves no temp sibling when the staging write fails', async () => {
    const fspImpl = {
      ...fsp,
      open: async (target: fs.PathLike, flags: string, mode: number) => {
        const handle = await fsp.open(target, flags, mode);
        return {
          writeFile: async () => {
            throw new Error('ENOSPC: no space left on device');
          },
          close: () => handle.close(),
        };
      },
    } as unknown as typeof fsp;

    await expect(
      writeChartFiles(
        [
          { path: 'a.svg', content: 'a' },
          { path: 'b.svg', content: 'b' },
        ],
        { workspace, fspImpl },
      ),
    ).rejects.toThrow(/ENOSPC/);
    expect(fs.readdirSync(workspace)).toEqual([]);
  });

  it('leaves no temp sibling when the single-file write fails', async () => {
    const fspImpl = {
      ...fsp,
      open: async (target: fs.PathLike, flags: string, mode: number) => {
        const handle = await fsp.open(target, flags, mode);
        return {
          writeFile: async () => {
            throw new Error('EIO: i/o error');
          },
          close: () => handle.close(),
        };
      },
    } as unknown as typeof fsp;

    await expect(
      writeChartFile('only.svg', 'x', { workspace, fspImpl }),
    ).rejects.toThrow(/EIO/);
    expect(fs.readdirSync(workspace)).toEqual([]);
  });

  it('accepts an empty batch', async () => {
    await expect(writeChartFiles([], { workspace })).resolves.toEqual([]);
  });
});
