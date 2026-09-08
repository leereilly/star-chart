import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { run, type RunDeps } from '../src/run.js';
import type { ApiClient } from '../src/api/client.js';
import { FIXED_NOW, MS_WEEK, makeScratchDir } from './helpers/index.js';

function historyData(adds: number[]): unknown[] {
  const start = FIXED_NOW - (adds.length - 1) * MS_WEEK;
  return adds.map((total, i) => ({
    timestamp: new Date(start + i * MS_WEEK).toISOString(),
    total,
    days: [total, 0, 0, 0, 0, 0, 0],
  }));
}

function makeClient(options: {
  stars?: number;
  adds?: number[];
  failHistory?: boolean;
  /** Per-repository overrides keyed by "owner/repo". */
  repos?: Record<string, { stars?: number; adds?: number[]; fail?: boolean }>;
  /** Records every requested repository, in order. */
  calls?: string[];
}): ApiClient {
  return {
    request: async (route, params) => {
      const owner = typeof params.owner === 'string' ? params.owner : 'octocat';
      const repo =
        typeof params.repo === 'string' ? params.repo : 'hello-world';
      const fullName = `${owner}/${repo}`;
      const entry = options.repos?.[fullName];
      options.calls?.push(
        `${fullName}:${route.includes('history') ? 'history' : 'meta'}`,
      );
      if (route.includes('stargazers/history')) {
        if (options.failHistory || entry?.fail) {
          throw Object.assign(new Error(`boom for ${fullName}`), {
            status: 500,
          });
        }
        return {
          status: 200,
          headers: {},
          data: historyData(entry?.adds ?? options.adds ?? [1, 2, 3, 4]),
        };
      }
      return {
        status: 200,
        headers: {},
        data: {
          full_name: fullName,
          name: repo,
          owner: { login: owner },
          created_at: new Date(FIXED_NOW - 60 * MS_WEEK).toISOString(),
          stargazers_count: entry?.stars ?? options.stars ?? 100,
        },
      };
    },
  };
}

interface Captured {
  outputs: Record<string, string>;
  failed: string[];
  warnings: string[];
  secrets: string[];
}

function makeDeps(
  workspace: string,
  inputs: Record<string, string>,
  client: ApiClient,
): { deps: RunDeps; captured: Captured } {
  const captured: Captured = {
    outputs: {},
    failed: [],
    warnings: [],
    secrets: [],
  };
  const deps: RunDeps = {
    getInput: (name) => inputs[name] ?? '',
    setOutput: (name, value) => {
      captured.outputs[name] = value;
    },
    setFailed: (message) => captured.failed.push(message),
    info: () => undefined,
    warning: (m) => captured.warnings.push(m),
    debug: () => undefined,
    setSecret: (s) => captured.secrets.push(s),
    createClient: () => client,
    now: () => FIXED_NOW,
    workspace,
    env: {},
    retry: { timers: { now: () => 0, sleep: async () => undefined } },
  };
  return { deps, captured };
}

describe('run orchestration', () => {
  let workspace: string;
  beforeEach(() => {
    workspace = makeScratchDir('run-');
  });
  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('carries independent axis and legend overrides into both written themes', async () => {
    const { deps, captured } = makeDeps(
      workspace,
      {
        repository: 'octocat/hello-world',
        style: 'sparkline',
        dual_theme: 'true',
        output: 'out/axes.svg',
        show_x_axis: 'false',
        show_y_axis: 'true',
        show_legend: 'true',
      },
      makeClient({}),
    );
    await run(deps);
    expect(captured.failed).toEqual([]);
    for (const theme of ['light', 'dark']) {
      const svg = fs.readFileSync(
        path.join(workspace, `out/axes-${theme}.svg`),
        'utf8',
      );
      expect(svg).not.toContain('class="sc-x-axis"');
      expect(svg).not.toContain('class="sc-dates"');
      expect(svg).toContain('class="sc-y-axis"');
      expect(svg).toContain('class="sc-legend"');
    }
  });

  it('preserves distinct repository histories in dual clustered output without refetching', async () => {
    const calls: string[] = [];
    const { deps, captured } = makeDeps(
      workspace,
      {
        repositories: 'octocat/hello-world,octocat/spoon-knife',
        style: 'clustered-bar',
        columns: '3',
        dual_theme: 'true',
        output: 'out/compare.svg',
      },
      makeClient({
        calls,
        repos: {
          'octocat/hello-world': { stars: 100, adds: [50, 1, 2, 3] },
          'octocat/spoon-knife': { stars: 200, adds: [10, 20] },
        },
      }),
    );
    const outputs = await run(deps);
    expect(captured.failed).toEqual([]);
    expect(outputs?.stars).toBe(300);
    expect(calls).toEqual([
      'octocat/hello-world:meta',
      'octocat/hello-world:history',
      'octocat/spoon-knife:meta',
      'octocat/spoon-knife:history',
    ]);
    for (const theme of ['light', 'dark']) {
      const svg = fs.readFileSync(
        path.join(workspace, `out/compare-${theme}.svg`),
        'utf8',
      );
      expect(svg.match(/data-repository=/g)).toHaveLength(6);
      expect(svg).toContain('octocat/hello-world: 56 recorded stars');
      expect(svg).toContain('octocat/spoon-knife: 30 recorded stars');
      expect(svg).not.toContain(': 86 recorded stars');
    }
  });

  it('writes the chart and sets outputs on success', async () => {
    const { deps, captured } = makeDeps(
      workspace,
      {
        repository: 'octocat/hello-world',
        token: 'secrettoken',
        output: 'out/chart.svg',
      },
      makeClient({ stars: 321, adds: [1, 2, 3, 4] }),
    );
    const outputs = await run(deps);
    expect(outputs).not.toBeNull();
    expect(captured.failed).toHaveLength(0);
    expect(captured.outputs.chart_path).toBe('out/chart.svg');
    expect(captured.outputs.stars).toBe('321');
    expect(captured.outputs.stars_added).toBe('10');
    expect(captured.outputs.period_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(captured.secrets).toContain('secrettoken');
    expect(fs.existsSync(path.join(workspace, 'out/chart.svg'))).toBe(true);
  });

  it('does not set outputs and calls setFailed on API failure', async () => {
    const { deps, captured } = makeDeps(
      workspace,
      { repository: 'octocat/hello-world', output: 'out/chart.svg' },
      makeClient({ failHistory: true }),
    );
    const outputs = await run(deps);
    expect(outputs).toBeNull();
    expect(captured.failed.length).toBeGreaterThan(0);
    expect(captured.outputs.chart_path).toBeUndefined();
    expect(fs.existsSync(path.join(workspace, 'out/chart.svg'))).toBe(false);
  });

  it('fails cleanly on invalid configuration', async () => {
    const { deps, captured } = makeDeps(
      workspace,
      { repository: 'bad-repo-no-slash', output: 'out/chart.svg' },
      makeClient({}),
    );
    const outputs = await run(deps);
    expect(outputs).toBeNull();
    expect(captured.failed.length).toBe(1);
  });

  it('skips rewriting unchanged content', async () => {
    const inputs = { repository: 'octocat/hello-world', output: 'chart.svg' };
    const client = makeClient({ adds: [1, 2, 3, 4] });
    const first = makeDeps(workspace, inputs, client);
    await run(first.deps);
    const second = makeDeps(workspace, inputs, client);
    await run(second.deps);
    // Second run should still set outputs but report unchanged (no throw).
    expect(second.captured.outputs.chart_path).toBe('chart.svg');
  });

  it('sets the rich outputs in single mode', async () => {
    const { deps, captured } = makeDeps(
      workspace,
      {
        repository: 'octocat/hello-world',
        output: 'out/chart.svg',
        weeks: '2',
      },
      makeClient({ stars: 500, adds: [10, 10, 1, 1] }),
    );
    const outputs = await run(deps);
    expect(outputs?.growthPercentage).toBe('10.00%');
    expect(captured.outputs.growth_percentage).toBe('10.00%');
    expect(captured.outputs.peak_gain).toBe('1');
    // Dual-only outputs are declared but empty.
    expect(captured.outputs.chart_path_light).toBe('');
    expect(captured.outputs.chart_path_dark).toBe('');
    expect(captured.outputs.picture_snippet).toBe('');
  });

  it('writes two themed files and one snippet in dual mode', async () => {
    const { deps, captured } = makeDeps(
      workspace,
      {
        repository: 'octocat/hello-world',
        output: 'assets/chart.svg',
        dual_theme: 'true',
        theme: 'auto',
      },
      makeClient({ stars: 321, adds: [1, 2, 3, 4] }),
    );
    const outputs = await run(deps);
    expect(outputs).not.toBeNull();
    expect(captured.failed).toHaveLength(0);

    const light = path.join(workspace, 'assets/chart-light.svg');
    const dark = path.join(workspace, 'assets/chart-dark.svg');
    expect(fs.existsSync(light)).toBe(true);
    expect(fs.existsSync(dark)).toBe(true);
    expect(fs.existsSync(path.join(workspace, 'assets/chart.svg'))).toBe(false);

    const lightSvg = fs.readFileSync(light, 'utf8');
    const darkSvg = fs.readFileSync(dark, 'utf8');
    expect(lightSvg).not.toBe(darkSvg);
    // Fixed themes: neither file carries the auto-theme media query.
    expect(lightSvg).not.toContain('prefers-color-scheme');
    expect(darkSvg).not.toContain('prefers-color-scheme: dark');
    expect(lightSvg).toContain('#ebedf0');
    expect(darkSvg).toContain('#30363d');

    expect(captured.outputs.chart_path).toBe('assets/chart-light.svg');
    expect(captured.outputs.chart_path_light).toBe('assets/chart-light.svg');
    expect(captured.outputs.chart_path_dark).toBe('assets/chart-dark.svg');
    expect(captured.outputs.picture_snippet).toContain(
      'srcset="assets/chart-dark.svg"',
    );
    expect(captured.outputs.picture_snippet).toContain(
      'src="assets/chart-light.svg"',
    );
    expect(captured.warnings.join(' ')).toMatch(/theme/i);
  });

  it('fetches and models once for both dual files', async () => {
    const calls: string[] = [];
    const { deps } = makeDeps(
      workspace,
      {
        repository: 'octocat/hello-world',
        output: 'chart.svg',
        dual_theme: 'true',
      },
      makeClient({ calls }),
    );
    await run(deps);
    expect(calls).toEqual([
      'octocat/hello-world:meta',
      'octocat/hello-world:history',
    ]);
  });

  it('aggregates several repositories into one chart', async () => {
    const calls: string[] = [];
    const { deps, captured } = makeDeps(
      workspace,
      {
        repositories: 'octocat/one, octocat/two',
        output: 'chart.svg',
      },
      makeClient({
        calls,
        repos: {
          'octocat/one': { stars: 100, adds: [1, 2, 3, 4] },
          'octocat/two': { stars: 40, adds: [10, 20, 30, 40] },
        },
      }),
    );
    const outputs = await run(deps);
    expect(outputs).not.toBeNull();
    expect(calls).toEqual([
      'octocat/one:meta',
      'octocat/one:history',
      'octocat/two:meta',
      'octocat/two:history',
    ]);
    expect(captured.outputs.stars).toBe('140');
    expect(captured.outputs.stars_added).toBe('110');
    expect(captured.outputs.peak_gain).toBe('44');
    const svg = fs.readFileSync(path.join(workspace, 'chart.svg'), 'utf8');
    expect(svg).toContain('octocat/one + octocat/two');
  });

  it('writes nothing and sets no outputs when one repository fails', async () => {
    const { deps, captured } = makeDeps(
      workspace,
      {
        repositories: 'octocat/one\noctocat/two\noctocat/three',
        output: 'chart.svg',
      },
      makeClient({
        repos: { 'octocat/two': { fail: true } },
      }),
    );
    const outputs = await run(deps);
    expect(outputs).toBeNull();
    expect(captured.outputs).toEqual({});
    expect(fs.existsSync(path.join(workspace, 'chart.svg'))).toBe(false);
    expect(captured.failed.join(' ')).toContain('octocat/two');
  });

  it('fails before writing when a dual path is invalid', async () => {
    const { deps, captured } = makeDeps(
      workspace,
      {
        repository: 'octocat/hello-world',
        output: 'chart.png',
        dual_theme: 'true',
      },
      makeClient({}),
    );
    expect(await run(deps)).toBeNull();
    expect(captured.failed).toHaveLength(1);
    expect(fs.readdirSync(workspace)).toEqual([]);
  });
});
