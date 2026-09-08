import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  buildChartModel,
  buildFrameSequence,
  renderChartGif,
  validateOutputPath,
  outputFormat,
  deriveDualPaths,
  parseInputs,
  ConfigError,
} from '../src/lib.js';
import { run, type RunDeps } from '../src/run.js';
import type { ApiClient } from '../src/api/client.js';
import {
  FIXED_NOW,
  MS_WEEK,
  historyFromAdds,
  makeConfig,
  makeMetadata,
  makeScratchDir,
} from './helpers/index.js';

/** A rising cumulative history so column heights differ across the window. */
const RISING = Array.from({ length: 24 }, (_, i) => i + 1);

function animatedModel(raw: Record<string, string> = {}) {
  const config = makeConfig({
    style: 'contributions',
    animation: 'once',
    ...raw,
  });
  return buildChartModel(config, makeMetadata(), historyFromAdds(RISING), {
    asOf: FIXED_NOW,
  });
}

/** Sum of column translate offsets: shrinks as more cells are exposed. */
function translateLoad(svg: string): number {
  return [...svg.matchAll(/translate\(0 ([0-9.]+)\)/g)].reduce(
    (sum, match) => sum + Number(match[1]),
    0,
  );
}

/** Builds a non-contributions chart model for a given style. */
function styledModel(style: string, raw: Record<string, string> = {}) {
  const config = makeConfig({ style, animation: 'once', ...raw });
  return buildChartModel(config, makeMetadata(), historyFromAdds(RISING), {
    asOf: FIXED_NOW,
  });
}

/**
 * Opacity of the header total text (the element carrying the ★ tspan). Returns
 * `null` when no explicit opacity is baked (fully visible / not revealed).
 */
function totalOpacity(svg: string): number | null {
  const segment = svg
    .split('<text')
    .find((part) => part.includes('★') && part.includes('sc-total'));
  if (!segment) {
    return null;
  }
  const head = segment.split('</text>')[0] ?? '';
  const match = /opacity="([0-9.]+)"/.exec(head);
  return match ? Number(match[1]) : null;
}

/** Total drawn dash length of stroke-drawn lines (line/sparkline draw). */
function drawnLength(svg: string): number {
  return [...svg.matchAll(/stroke-dasharray="([0-9.]+) /g)].reduce(
    (sum, match) => sum + Number(match[1]),
    0,
  );
}

/** Width of the first clip-wipe rect (area/styled reveal). */
function clipWidth(svg: string): number {
  const match = /<clipPath[^>]*><rect[^>]*width="([0-9.]+)"/.exec(svg);
  return match ? Number(match[1]) : NaN;
}

/** Summed height of grown bar rects (bar scale). */
function barLoad(svg: string): number {
  return [...svg.matchAll(/class="sc-bar"[^>]*height="([0-9.]+)"/g)].reduce(
    (sum, match) => sum + Number(match[1]),
    0,
  );
}

describe('output path formats', () => {
  it('accepts .gif alongside .svg and rejects others', () => {
    expect(validateOutputPath('assets/lee.gif')).toBe('assets/lee.gif');
    expect(validateOutputPath('lee.SVG')).toBe('lee.SVG');
    expect(() => validateOutputPath('chart.png')).toThrow();
    expect(() => validateOutputPath('chart.webp')).toThrow();
  });

  it('classifies the format from the extension, case-insensitively', () => {
    expect(outputFormat('a/b/lee.gif')).toBe('gif');
    expect(outputFormat('a/b/lee.GIF')).toBe('gif');
    expect(outputFormat('a/b/chart.svg')).toBe('svg');
  });

  it('derives dual gif paths preserving the extension', () => {
    expect(deriveDualPaths('lee.gif')).toEqual({
      light: 'lee-light.gif',
      dark: 'lee-dark.gif',
    });
  });

  it('rejects a single auto-theme GIF but allows dual', () => {
    expect(() =>
      parseInputs({
        repository: 'octocat/hello-world',
        output: 'lee.gif',
        theme: 'auto',
      }),
    ).toThrow(ConfigError);
    expect(() =>
      parseInputs({
        repository: 'octocat/hello-world',
        output: 'lee.gif',
        theme: 'auto',
        dual_theme: 'true',
      }),
    ).not.toThrow();
  });
});

describe('buildFrameSequence', () => {
  it('freezes an animated contributions chart into growing frames', () => {
    const sequence = buildFrameSequence(animatedModel(), { fps: 12 });
    expect(sequence.frames.length).toBeGreaterThan(10);
    expect(sequence.loop).toBe(false);
    expect(sequence.theme).toBe('light');

    const loads = sequence.frames.map((frame) => translateLoad(frame.svg));
    // Monotonic reveal: every frame exposes at least as much as the previous.
    for (let i = 1; i < loads.length; i += 1) {
      expect(loads[i]).toBeLessThanOrEqual(loads[i - 1] as number);
    }
    // The build genuinely progresses from (near) empty to a fuller chart.
    expect(loads[0]).toBeGreaterThan(loads[loads.length - 1] as number);

    // Frames are not duplicates of one another.
    const distinct = new Set(sequence.frames.map((frame) => frame.svg));
    expect(distinct.size).toBeGreaterThan(5);

    // Frozen frames carry no CSS keyframes or animation rules.
    for (const frame of sequence.frames) {
      expect(frame.svg).not.toContain('@keyframes');
      expect(frame.svg).not.toContain('animation:');
    }
  });

  it('marks looping animations to repeat', () => {
    const sequence = buildFrameSequence(animatedModel({ animation: 'loop' }), {
      fps: 8,
    });
    expect(sequence.loop).toBe(true);
    expect(sequence.frames.length).toBeGreaterThan(2);
  });

  it('ends a "once" build on the completed chart, matching the static frame', () => {
    const model = animatedModel({ animation: 'once' });
    const sequence = buildFrameSequence(model, { fps: 12 });
    const still = buildFrameSequence(animatedModel({ animation: 'none' }));

    const last = sequence.frames[sequence.frames.length - 1];
    // The terminal frame is exactly the finished chart...
    expect(last?.svg).toBe(still.frames[0]?.svg);
    // ...it is held noticeably longer than a build frame...
    const buildDelay = sequence.frames[0]?.delayMs ?? 0;
    expect(last?.delayMs ?? 0).toBeGreaterThan(buildDelay);
    // ...and it exposes strictly more than the first (near-empty) build frame.
    expect(translateLoad(last?.svg ?? '')).toBeLessThan(
      translateLoad(sequence.frames[0]?.svg ?? ''),
    );
  });

  it('omits the one-time delay from a loop so no empty gap replays', () => {
    // A large initial delay must not translate into leading empty frames that
    // would replay on every GIF loop.
    const delayed = buildFrameSequence(
      animatedModel({ animation: 'loop', animation_delay: '5' }),
      { fps: 8 },
    );
    const undelayed = buildFrameSequence(
      animatedModel({ animation: 'loop', animation_delay: '0' }),
      { fps: 8 },
    );
    const emptyLoad = translateLoad(undelayed.frames[0]?.svg ?? '');
    // With the delay omitted, the delayed loop still starts building
    // immediately: its first frame matches the undelayed loop's first frame.
    expect(translateLoad(delayed.frames[0]?.svg ?? '')).toBe(emptyLoad);
    // The delay adds no extra leading empty frames: the delayed and undelayed
    // loops hold the empty state for exactly the same number of frames.
    const countEmpty = (seq: typeof delayed): number =>
      seq.frames.filter((frame) => translateLoad(frame.svg) === emptyLoad)
        .length;
    expect(countEmpty(delayed)).toBe(countEmpty(undelayed));
  });

  it('emits a single frame for a non-animated contributions chart', () => {
    const sequence = buildFrameSequence(animatedModel({ animation: 'none' }));
    expect(sequence.frames).toHaveLength(1);
    expect(sequence.loop).toBe(false);
    // Uses the attribute transform resvg can apply, not the CSS property.
    expect(sequence.frames[0]?.svg).toContain('transform="translate(0 ');
  });

  it('hides the contributions shading legend when show_legend is false', () => {
    const withLegend = buildFrameSequence(animatedModel({ animation: 'none' }));
    const withoutLegend = buildFrameSequence(
      animatedModel({ animation: 'none', show_legend: 'false' }),
    );
    // The shading legend labels are present by default...
    expect(withLegend.frames[0]?.svg).toContain('Below tip (3+)');
    expect(withLegend.frames[0]?.svg).toContain('Unoccupied');
    // ...and fully removed (no legend group, no labels) when opted out.
    expect(withoutLegend.frames[0]?.svg).not.toContain('Below tip (3+)');
    expect(withoutLegend.frames[0]?.svg).not.toContain('Unoccupied');
    expect(withoutLegend.frames[0]?.svg).not.toContain('sc-legend');
  });

  it('keeps the legend opt-out across every animated GIF frame', () => {
    const sequence = buildFrameSequence(
      animatedModel({ animation: 'once', show_legend: 'false' }),
      { fps: 10 },
    );
    for (const frame of sequence.frames) {
      expect(frame.svg).not.toContain('sc-legend');
      expect(frame.svg).not.toContain('Unoccupied');
    }
  });

  it('bakes the animate_total reveal into frozen contributions frames', () => {
    const sequence = buildFrameSequence(
      animatedModel({ animation: 'once', animate_total: 'true' }),
      { fps: 16 },
    );
    const build = sequence.frames.slice(0, -1);
    const opacities = build.map((frame) => totalOpacity(frame.svg));

    // Every build frame bakes an explicit opacity (not left fully visible).
    expect(opacities.every((value) => value !== null)).toBe(true);
    // The first frame hides the total (reveal has not started)...
    expect(opacities[0]).toBe(0);
    // ...a near-end frame is partway through the fade...
    const nearEnd = opacities[opacities.length - 1] as number;
    expect(nearEnd).toBeGreaterThan(0);
    expect(nearEnd).toBeLessThanOrEqual(1);
    // ...and the reveal never runs backwards.
    for (let i = 1; i < opacities.length; i += 1) {
      expect(opacities[i] as number).toBeGreaterThanOrEqual(
        opacities[i - 1] as number,
      );
    }
    // The terminal frame holds the fully revealed total.
    expect(totalOpacity(sequence.frames[sequence.frames.length - 1]!.svg)).toBe(
      1,
    );
    // No CSS animation survives into any frozen frame.
    for (const frame of sequence.frames) {
      expect(frame.svg).not.toContain('@keyframes');
      expect(frame.svg).not.toContain('animation:');
    }
  });

  it('reveals animate_total during the loop cycle and holds it through the pause', () => {
    const sequence = buildFrameSequence(
      animatedModel({ animation: 'loop', animate_total: 'true' }),
      { fps: 16 },
    );
    const opacities = sequence.frames.map((frame) => totalOpacity(frame.svg));
    expect(opacities.every((value) => value !== null)).toBe(true);
    // The build starts hidden and the pause tail holds the total fully shown.
    expect(Math.min(...(opacities as number[]))).toBe(0);
    expect(Math.max(...(opacities as number[]))).toBe(1);
    for (const frame of sequence.frames) {
      expect(frame.svg).not.toContain('@keyframes');
    }
  });

  it('leaves the total fully visible when animate_total is off (default)', () => {
    const sequence = buildFrameSequence(animatedModel({ animation: 'once' }), {
      fps: 12,
    });
    // No reveal is baked: the total carries no opacity attribute in any frame.
    for (const frame of sequence.frames) {
      expect(totalOpacity(frame.svg)).toBeNull();
    }
  });

  it('emits one static, animation-free frame for a non-animated non-contributions style', () => {
    const sequence = buildFrameSequence(
      styledModel('line', { animation: 'none' }),
    );
    expect(sequence.frames).toHaveLength(1);
    expect(sequence.frames[0]?.svg).not.toContain('@keyframes');
    expect(sequence.frames[0]?.svg).not.toContain('animation:');
  });

  it('freezes a line "draw" (stroke-dashoffset) into a growing multi-frame draw', () => {
    const model = styledModel('line', { animation: 'loop' });
    const sequence = buildFrameSequence(model, { fps: 12 });
    expect(sequence.frames.length).toBeGreaterThan(5);

    const lengths = sequence.frames.map((frame) => drawnLength(frame.svg));
    // Every frozen frame draws an absolute dash length (resvg ignores
    // pathLength), and the drawn length only grows across the build.
    expect(lengths.some((value) => value > 0)).toBe(true);
    const build = lengths.slice(0, Math.ceil(lengths.length * 0.75));
    for (let i = 1; i < build.length; i += 1) {
      expect(build[i]).toBeGreaterThanOrEqual(build[i - 1] as number);
    }
    // Genuine motion: an early frame draws strictly less than a late one.
    expect(lengths[1] as number).toBeLessThan(
      lengths[lengths.length - 1] as number,
    );
    for (const frame of sequence.frames) {
      expect(frame.svg).not.toContain('@keyframes');
      expect(frame.svg).not.toContain('animation:');
    }
  });

  it('freezes a clip-wipe reveal (area) into a widening clip rect', () => {
    const model = styledModel('area', { animation: 'loop' });
    const sequence = buildFrameSequence(model, { fps: 12 });
    const widths = sequence.frames.map((frame) => clipWidth(frame.svg));
    expect(widths.every((value) => Number.isFinite(value))).toBe(true);
    const build = widths.slice(0, Math.ceil(widths.length * 0.75));
    for (let i = 1; i < build.length; i += 1) {
      expect(build[i]).toBeGreaterThanOrEqual(build[i - 1] as number);
    }
    expect(widths[0] as number).toBeLessThan(
      widths[build.length - 1] as number,
    );
  });

  it('freezes a styled clip-wipe (grid) the same way', () => {
    const sequence = buildFrameSequence(
      styledModel('grid', { animation: 'loop' }),
      {
        fps: 10,
      },
    );
    const widths = sequence.frames.map((frame) => clipWidth(frame.svg));
    expect(widths.every((value) => Number.isFinite(value))).toBe(true);
    expect(widths[0] as number).toBeLessThan(
      widths[widths.length - 1] as number,
    );
  });

  it('freezes a bar "grow" (scaleY) into growing bar geometry', () => {
    const model = styledModel('bar', { animation: 'loop' });
    const sequence = buildFrameSequence(model, { fps: 12 });
    const loads = sequence.frames.map((frame) => barLoad(frame.svg));
    const build = loads.slice(0, Math.ceil(loads.length * 0.75));
    for (let i = 1; i < build.length; i += 1) {
      expect(build[i]).toBeGreaterThanOrEqual(build[i - 1] as number);
    }
    expect(loads[0] as number).toBeLessThan(loads[build.length - 1] as number);
    // Bars are baked as static geometry, not CSS transforms.
    for (const frame of sequence.frames) {
      expect(frame.svg).not.toContain('@keyframes');
      expect(frame.svg).not.toContain('scaleY');
    }
  });

  it('ends a non-contributions "once" build on the finished static chart', () => {
    for (const style of ['line', 'area', 'bar', 'grid']) {
      const sequence = buildFrameSequence(styledModel(style), { fps: 10 });
      const still = buildFrameSequence(
        styledModel(style, { animation: 'none' }),
      );
      const last = sequence.frames[sequence.frames.length - 1];
      // The terminal frame is exactly the finished chart (static equivalent)...
      expect(last?.svg).toBe(still.frames[0]?.svg);
      // ...and is held longer than a build frame.
      expect(last?.delayMs ?? 0).toBeGreaterThan(
        sequence.frames[0]?.delayMs ?? 0,
      );
    }
  });

  it('marks a looping non-contributions animation to repeat', () => {
    const sequence = buildFrameSequence(
      styledModel('line', { animation: 'loop' }),
      {
        fps: 8,
      },
    );
    expect(sequence.loop).toBe(true);
    expect(sequence.frames.length).toBeGreaterThan(2);
  });

  it('renders dark frames when the theme is dark', () => {
    const sequence = buildFrameSequence(animatedModel({ theme: 'dark' }), {
      fps: 6,
    });
    expect(sequence.theme).toBe('dark');
  });
});

describe('renderChartGif', () => {
  it('encodes a valid, multi-frame animated GIF', async () => {
    const gif = await renderChartGif(animatedModel(), {
      width: 320,
      fps: 10,
    });
    // GIF89a magic header.
    expect([...gif.buffer.slice(0, 6)]).toEqual([...Buffer.from('GIF89a')]);
    expect(gif.width).toBe(320);
    expect(gif.height).toBeGreaterThan(0);
    expect(gif.frameCount).toBeGreaterThan(5);
    expect(gif.loop).toBe(false);
    expect(gif.bytes).toBe(gif.buffer.byteLength);

    // A real animation: distinct Graphic Control Extension frame markers.
    const markers = countFrames(gif.buffer);
    expect(markers).toBe(gif.frameCount);
  });

  it('encodes a single-frame GIF for a static chart', async () => {
    const gif = await renderChartGif(animatedModel({ animation: 'none' }), {
      width: 240,
    });
    expect(gif.frameCount).toBe(1);
    expect(countFrames(gif.buffer)).toBe(1);
  });

  it('encodes a multi-frame GIF for an animated non-contributions style', async () => {
    const gif = await renderChartGif(
      styledModel('line', { animation: 'once' }),
      {
        width: 320,
        fps: 10,
      },
    );
    expect([...gif.buffer.slice(0, 6)]).toEqual([...Buffer.from('GIF89a')]);
    expect(gif.frameCount).toBeGreaterThan(5);
    expect(countFrames(gif.buffer)).toBe(gif.frameCount);
  });
});

/** Counts frames via Graphic Control Extension blocks (0x21 0xF9 0x04). */
function countFrames(buffer: Uint8Array): number {
  let count = 0;
  for (let i = 0; i + 2 < buffer.length; i += 1) {
    if (
      buffer[i] === 0x21 &&
      buffer[i + 1] === 0xf9 &&
      buffer[i + 2] === 0x04
    ) {
      count += 1;
    }
  }
  return count;
}

describe('run() GIF output', () => {
  let workspace: string;
  beforeEach(() => {
    workspace = makeScratchDir('gif-run-');
  });
  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  function makeDeps(inputs: Record<string, string>): {
    deps: RunDeps;
    outputs: Record<string, string>;
    failed: string[];
  } {
    const outputs: Record<string, string> = {};
    const failed: string[] = [];
    const client: ApiClient = {
      request: async (route) => {
        if (route.includes('stargazers/history')) {
          const start = FIXED_NOW - (RISING.length - 1) * MS_WEEK;
          return {
            status: 200,
            headers: {},
            data: RISING.map((total, i) => ({
              timestamp: new Date(start + i * MS_WEEK).toISOString(),
              total,
              days: [total, 0, 0, 0, 0, 0, 0],
            })),
          };
        }
        return {
          status: 200,
          headers: {},
          data: {
            full_name: 'octocat/hello-world',
            name: 'hello-world',
            owner: { login: 'octocat' },
            created_at: new Date(FIXED_NOW - 60 * MS_WEEK).toISOString(),
            stargazers_count: 512,
          },
        };
      },
    };
    const deps: RunDeps = {
      getInput: (name) => inputs[name] ?? '',
      setOutput: (name, value) => {
        outputs[name] = value;
      },
      setFailed: (message) => failed.push(message),
      info: () => undefined,
      warning: () => undefined,
      debug: () => undefined,
      setSecret: () => undefined,
      createClient: () => client,
      now: () => FIXED_NOW,
      workspace,
      env: {},
      retry: { timers: { now: () => 0, sleep: async () => undefined } },
    };
    return { deps, outputs, failed };
  }

  it('writes a valid animated GIF file and reports its path', async () => {
    const { deps, outputs, failed } = makeDeps({
      repository: 'octocat/hello-world',
      style: 'contributions',
      animation: 'once',
      animation_duration: '0.5',
      width: '300',
      output: 'out/lee.gif',
    });
    const result = await run(deps);
    expect(failed).toEqual([]);
    expect(result).not.toBeNull();
    expect(outputs.chart_path).toBe('out/lee.gif');

    const file = fs.readFileSync(path.join(workspace, 'out/lee.gif'));
    expect(file.subarray(0, 6).toString('latin1')).toBe('GIF89a');
    expect(file.byteLength).toBeGreaterThan(100);
  });

  it('writes a light and dark GIF pair in dual mode', async () => {
    const { deps, outputs, failed } = makeDeps({
      repository: 'octocat/hello-world',
      style: 'contributions',
      animation: 'once',
      animation_duration: '0.5',
      width: '360',
      dual_theme: 'true',
      output: 'out/pair.gif',
    });
    await run(deps);
    expect(failed).toEqual([]);
    expect(outputs.chart_path_light).toBe('out/pair-light.gif');
    expect(outputs.chart_path_dark).toBe('out/pair-dark.gif');
    for (const name of ['out/pair-light.gif', 'out/pair-dark.gif']) {
      const file = fs.readFileSync(path.join(workspace, name));
      expect(file.subarray(0, 6).toString('latin1')).toBe('GIF89a');
    }
  });
});
