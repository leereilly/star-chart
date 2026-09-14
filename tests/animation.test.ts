import { describe, it, expect } from 'vitest';
import {
  columnSchedule,
  columnWindow,
  keyframesForColumn,
  resolveTimeline,
} from '../src/renderers/animation.js';
import { renderContributions } from '../src/renderers/contributions.js';
import { buildChartModel } from '../src/history/model.js';
import type { AnimationConfig } from '../src/models/index.js';
import {
  FIXED_NOW,
  historyFromAdds,
  makeConfig,
  makeMetadata,
  checkSvg,
} from './helpers/index.js';

const baseAnim = (over: Partial<AnimationConfig> = {}): AnimationConfig => ({
  mode: 'once',
  durationSeconds: 4,
  pauseSeconds: 2,
  delaySeconds: 0,
  style: 'grow',
  direction: 'chronological',
  easing: 'ease-out',
  animateTotal: false,
  ...over,
});

describe('resolveTimeline', () => {
  it('once cycle equals duration', () => {
    const t = resolveTimeline(baseAnim({ mode: 'once' }));
    expect(t.cycleSeconds).toBe(4);
    expect(t.iteration).toBe('1');
  });

  it('loop cycle equals duration + pause and repeats', () => {
    const t = resolveTimeline(baseAnim({ mode: 'loop' }));
    expect(t.cycleSeconds).toBe(6);
    expect(t.iteration).toBe('infinite');
  });

  it('local grow duration is max(0.35, build*0.15)', () => {
    expect(
      resolveTimeline(baseAnim({ durationSeconds: 4 })).localSeconds,
    ).toBeCloseTo(0.6);
    expect(
      resolveTimeline(baseAnim({ durationSeconds: 1 })).localSeconds,
    ).toBeCloseTo(0.35);
  });
});

describe('columnWindow chronological', () => {
  it('first column starts near 0, last finishes at build', () => {
    const anim = baseAnim();
    const t = resolveTimeline(anim);
    const first = columnWindow(0, 52, anim, t);
    const last = columnWindow(51, 52, anim, t);
    expect(first.startFrac).toBeCloseTo(0, 5);
    expect(last.endFrac).toBeCloseTo(1, 5); // finishes at build == cycle for once
  });

  it('mid columns are staggered across the build', () => {
    const anim = baseAnim();
    const t = resolveTimeline(anim);
    const c13 = columnWindow(13, 52, anim, t);
    const c26 = columnWindow(26, 52, anim, t);
    // col13 starts around 1s (0.25 of 4s span), col26 around 1.7s.
    expect(c13.startFrac * t.cycleSeconds).toBeGreaterThan(0.6);
    expect(c13.startFrac * t.cycleSeconds).toBeLessThan(1.3);
    expect(c26.startFrac).toBeGreaterThan(c13.startFrac);
  });

  it('simultaneous direction gives every column the same window', () => {
    const anim = baseAnim({ direction: 'simultaneous' });
    const t = resolveTimeline(anim);
    const a = columnWindow(0, 52, anim, t);
    const b = columnWindow(40, 52, anim, t);
    expect(a).toEqual(b);
  });
});

describe('columnSchedule invariants', () => {
  it('grow exposes exactly `height` cells, monotonically, ending at 100%', () => {
    const anim = baseAnim();
    const t = resolveTimeline(anim);
    const height = 37;
    const steps = columnSchedule({
      style: 'grow',
      easing: 'ease-out',
      height,
      index: 10,
      columns: 52,
      rows: 100,
      window: columnWindow(10, 52, anim, t),
      cascadeColumnFrac: 0,
      cascadeRowFrac: 0,
    });
    // Monotonic non-decreasing exposed, capped at height.
    let prev = -1;
    for (const s of steps) {
      expect(s.exposed).toBeGreaterThanOrEqual(prev);
      expect(s.exposed).toBeLessThanOrEqual(height);
      prev = s.exposed;
    }
    const last = steps[steps.length - 1];
    expect(last?.pct).toBe(100);
    expect(last?.exposed).toBe(height);
    // Percentages are within [0,100] and sorted.
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]!.pct).toBeGreaterThanOrEqual(steps[i - 1]!.pct);
      expect(steps[i]!.pct).toBeLessThanOrEqual(100);
    }
  });

  it('reveal jumps straight to full height', () => {
    const steps = columnSchedule({
      style: 'reveal',
      easing: 'linear',
      height: 20,
      index: 3,
      columns: 10,
      rows: 100,
      window: { startFrac: 0.1, endFrac: 0.2 },
      cascadeColumnFrac: 0,
      cascadeRowFrac: 0,
    });
    const exposedValues = steps.map((s) => s.exposed);
    expect(exposedValues).toContain(20);
    // Only 0 and full height appear (no intermediate cells).
    expect(new Set(exposedValues)).toEqual(new Set([0, 20]));
  });

  it('height 0 stays hidden', () => {
    const steps = columnSchedule({
      style: 'grow',
      easing: 'ease-out',
      height: 0,
      index: 0,
      columns: 5,
      rows: 100,
      window: { startFrac: 0, endFrac: 0.1 },
      cascadeColumnFrac: 0,
      cascadeRowFrac: 0,
    });
    expect(steps.every((s) => s.exposed === 0)).toBe(true);
  });
});

describe('keyframesForColumn', () => {
  it('emits grid-aligned translateY multiples of pitch with step timing', () => {
    const steps = [
      { pct: 0, exposed: 0 },
      { pct: 50, exposed: 1 },
      { pct: 100, exposed: 2 },
    ];
    const css = keyframesForColumn('c', steps, 100, 10);
    expect(css).toContain('translateY(1000px)'); // exposed 0 -> (100-0)*10
    expect(css).toContain('translateY(990px)'); // exposed 1
    expect(css).toContain('translateY(980px)'); // exposed 2
    expect(css).toContain('steps(1,end)');
  });
});

describe('animated contributions output', () => {
  function animatedSvg(over: Record<string, string>): string {
    const history = historyFromAdds([1, 2, 3, 4, 5, 6, 7, 8]);
    const config = makeConfig({
      columns: '8',
      weeks: '8',
      rows: '20',
      ...over,
    });
    const model = buildChartModel(config, makeMetadata(), history, {
      asOf: FIXED_NOW,
    });
    return renderContributions(model);
  }

  it('wraps animation in prefers-reduced-motion: no-preference', () => {
    const svg = animatedSvg({ animation: 'once' });
    expect(svg).toContain('@media (prefers-reduced-motion:no-preference)');
    expect(checkSvg(svg).ok).toBe(true);
  });

  it('static transform describes the final state (reduced-motion safe)', () => {
    const svg = animatedSvg({ animation: 'once' });
    // Every column group carries an inline final transform outside the media query.
    expect(svg).toContain('style="transform:translateY(');
  });

  it('loop uses infinite iteration and cycle = duration + pause', () => {
    const svg = animatedSvg({ animation: 'loop', animation_pause: '2s' });
    expect(svg).toContain('6s linear'); // 4 + 2
    expect(svg).toContain('infinite');
  });

  it('none produces no animation rules', () => {
    const svg = animatedSvg({ animation: 'none' });
    expect(svg).not.toContain('prefers-reduced-motion');
  });

  it('animate_total reveals the stars near the end', () => {
    const svg = animatedSvg({ animation: 'once', animate_total: 'true' });
    expect(svg).toContain('90%{opacity:0;}100%{opacity:1;}');
  });
});
