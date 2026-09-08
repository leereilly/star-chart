import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { makeScratchDir } from './helpers/index.js';

let scratch: string;
let bundlePath: string;
let libPath: string;

beforeAll(async () => {
  scratch = makeScratchDir('bundle-');
  bundlePath = path.join(scratch, 'index.mjs');
  libPath = path.join(scratch, 'lib.mjs');
  const common = {
    bundle: true,
    platform: 'node' as const,
    target: 'node24',
    format: 'esm' as const,
    logLevel: 'silent' as const,
    banner: {
      js: "import { createRequire as __cr } from 'node:module';const require=__cr(import.meta.url);",
    },
  };
  await build({
    ...common,
    entryPoints: ['src/index.ts'],
    outfile: bundlePath,
  });
  await build({
    ...common,
    entryPoints: ['src/lib.ts'],
    outfile: libPath,
    banner: {},
  });
}, 60_000);

afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

describe('bundle smoke test', () => {
  it('runs the bundled action end-to-end with a stubbed network', () => {
    const workspace = path.join(scratch, 'ws');
    fs.mkdirSync(workspace, { recursive: true });
    const outputFile = path.join(scratch, 'gh_output');
    fs.writeFileSync(outputFile, '');

    const stub = path.resolve('tests/helpers/fetch-stub.mjs');
    execFileSync('node', ['--import', stub, bundlePath], {
      env: {
        ...process.env,
        INPUT_REPOSITORY: 'octocat/hello-world',
        INPUT_TOKEN: '',
        INPUT_OUTPUT: 'assets/chart.svg',
        INPUT_ANIMATION: 'once',
        GITHUB_WORKSPACE: workspace,
        GITHUB_OUTPUT: outputFile,
        GITHUB_REPOSITORY: 'octocat/hello-world',
      },
      stdio: 'pipe',
    });

    const svgPath = path.join(workspace, 'assets/chart.svg');
    expect(fs.existsSync(svgPath)).toBe(true);
    const svg = fs.readFileSync(svgPath, 'utf8');
    expect(svg.startsWith('<svg')).toBe(true);

    const outputs = fs.readFileSync(outputFile, 'utf8');
    // core.setOutput writes name<<delimiter\nvalue\ndelimiter blocks.
    expect(outputs).toMatch(/stars<<[^\n]+\n4321\n/);
    expect(outputs).toMatch(/chart_path<<[^\n]+\nassets\/chart\.svg\n/);
    expect(outputs).toMatch(/period_start<<[^\n]+\n\d{4}-\d{2}-\d{2}\n/);
    // Single-theme runs still declare the dual-only outputs, but empty.
    expect(outputs).toMatch(/chart_path_light<<([^\n]+)\n\n\1/);
    expect(outputs).toMatch(/chart_path_dark<<([^\n]+)\n\n\1/);
    expect(outputs).toMatch(/picture_snippet<<([^\n]+)\n\n\1/);
  });

  it('writes a light/dark pair and a picture snippet in dual mode', () => {
    const workspace = path.join(scratch, 'ws-dual');
    fs.mkdirSync(workspace, { recursive: true });
    const outputFile = path.join(scratch, 'gh_output_dual');
    fs.writeFileSync(outputFile, '');

    const stub = path.resolve('tests/helpers/fetch-stub.mjs');
    execFileSync('node', ['--import', stub, bundlePath], {
      env: {
        ...process.env,
        INPUT_REPOSITORIES: 'octocat/hello-world, octocat/spoon-knife',
        INPUT_TOKEN: '',
        INPUT_OUTPUT: 'assets/chart.svg',
        INPUT_DUAL_THEME: 'true',
        INPUT_STYLE: 'clustered-bar',
        INPUT_COLUMNS: '8',
        GITHUB_WORKSPACE: workspace,
        GITHUB_OUTPUT: outputFile,
        GITHUB_REPOSITORY: 'octocat/hello-world',
      },
      stdio: 'pipe',
    });

    const light = path.join(workspace, 'assets/chart-light.svg');
    const dark = path.join(workspace, 'assets/chart-dark.svg');
    expect(fs.existsSync(light)).toBe(true);
    expect(fs.existsSync(dark)).toBe(true);
    expect(fs.existsSync(path.join(workspace, 'assets/chart.svg'))).toBe(false);
    expect(fs.readFileSync(light, 'utf8')).not.toBe(
      fs.readFileSync(dark, 'utf8'),
    );
    expect(fs.readFileSync(light, 'utf8')).toContain(
      'data-repository="octocat/spoon-knife"',
    );

    const outputs = fs.readFileSync(outputFile, 'utf8');
    // Stars are summed across both stubbed repositories (4321 + 1000).
    expect(outputs).toMatch(/stars<<[^\n]+\n5321\n/);
    expect(outputs).toMatch(/chart_path<<[^\n]+\nassets\/chart-light\.svg\n/);
    expect(outputs).toMatch(
      /chart_path_light<<[^\n]+\nassets\/chart-light\.svg\n/,
    );
    expect(outputs).toMatch(
      /chart_path_dark<<[^\n]+\nassets\/chart-dark\.svg\n/,
    );
    expect(outputs).toMatch(/growth_percentage<<[^\n]+\n(\d+\.\d{2}%|∞)\n/);
    expect(outputs).toMatch(/peak_gain<<[^\n]+\n\d+\n/);
    expect(outputs).toContain('<source media="(prefers-color-scheme: dark)"');
  });

  it('exposes a side-effect-free programmatic API', () => {
    const probe =
      'import * as lib from ' +
      JSON.stringify(bundleUrl(libPath)) +
      "; if(typeof lib.parseInputs!=='function') throw new Error('no parseInputs');" +
      "if(typeof lib.renderChart!=='function') throw new Error('no renderChart');" +
      "if(typeof lib.buildMultiRepositoryChartModel!=='function') throw new Error('no comparison model API');" +
      "if(typeof lib.renderMultiRepositoryStarChart!=='function') throw new Error('no comparison render API');" +
      "console.log('ok');";
    const out = execFileSync('node', ['--input-type=module', '-e', probe], {
      stdio: 'pipe',
    }).toString();
    expect(out).toContain('ok');
  });
});

function bundleUrl(p: string): string {
  return 'file://' + p.replace(/\\/g, '/');
}
