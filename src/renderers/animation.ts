import type { AnimationConfig, EasingName } from '../models/index.js';

/** Simple deterministic easing functions over normalized time [0,1]. */
export const EASINGS: Record<EasingName, (f: number) => number> = {
  linear: (f) => f,
  'ease-in': (f) => f * f,
  'ease-out': (f) => 1 - (1 - f) * (1 - f),
  'ease-in-out': (f) => f * f * (3 - 2 * f),
};

/** Inverse of the easing (time at which eased progress reaches `y`). */
export function inverseEasing(easing: EasingName, y: number): number {
  const clamped = Math.min(1, Math.max(0, y));
  if (clamped === 0 || clamped === 1) return clamped;
  switch (easing) {
    case 'linear':
      return clamped;
    case 'ease-in':
      return Math.sqrt(clamped);
    case 'ease-out':
      return 1 - Math.sqrt(1 - clamped);
    case 'ease-in-out': {
      // Numeric inverse of smoothstep.
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 40; i += 1) {
        const mid = (lo + hi) / 2;
        if (EASINGS['ease-in-out'](mid) < clamped) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return (lo + hi) / 2;
    }
  }
}

export interface Timeline {
  /** Length of one full animation cycle in seconds. */
  readonly cycleSeconds: number;
  /** Active build portion in seconds (before any loop pause). */
  readonly buildSeconds: number;
  /** Per-column local grow duration in seconds. */
  readonly localSeconds: number;
  /** CSS animation-iteration-count value. */
  readonly iteration: string;
  /** Initial delay in seconds (applied once). */
  readonly delaySeconds: number;
  readonly enabled: boolean;
}

/** Resolves cycle timing from the animation config. */
export function resolveTimeline(anim: AnimationConfig): Timeline {
  const build = anim.durationSeconds;
  const local =
    anim.direction === 'simultaneous' ? build : Math.max(0.35, build * 0.15);
  const cycle = anim.mode === 'loop' ? build + anim.pauseSeconds : build;
  return {
    cycleSeconds: cycle,
    buildSeconds: build,
    localSeconds: Math.min(local, build),
    iteration: anim.mode === 'loop' ? 'infinite' : '1',
    delaySeconds: anim.delaySeconds,
    enabled: anim.mode !== 'none',
  };
}

/**
 * Returns the [startFrac, endFrac] window (fractions of the cycle) during
 * which column `index` performs its build.
 */
export function columnWindow(
  index: number,
  columns: number,
  anim: AnimationConfig,
  timeline: Timeline,
): { startFrac: number; endFrac: number } {
  if (anim.direction === 'simultaneous' || columns <= 1) {
    return {
      startFrac: 0,
      endFrac: timeline.buildSeconds / timeline.cycleSeconds,
    };
  }
  // Keep adjacent windows overlapping even for sparse charts (e.g. four bars).
  const local = Math.max(
    timeline.localSeconds,
    timeline.buildSeconds / (1 + (columns - 1) * 0.75),
  );
  const span = timeline.buildSeconds - local;
  const frac = index / (columns - 1);
  const start = frac * span;
  const end = start + local;
  return {
    startFrac: start / timeline.cycleSeconds,
    endFrac: end / timeline.cycleSeconds,
  };
}

/** A build window with explicit pre-build and post-build holds. */
export function progressKeyframes(
  name: string,
  property: string,
  from: string,
  to: string,
  window: { startFrac: number; endFrac: number },
): string {
  return (
    `@keyframes ${name}{0%{${property}:${from};}` +
    (window.startFrac > 0
      ? `${keyframePercent(window.startFrac)}%{${property}:${from};}`
      : '') +
    `${keyframePercent(window.endFrac)}%{${property}:${to};}` +
    (window.endFrac < 1 ? `100%{${property}:${to};}` : '') +
    '}'
  );
}

/** Round down so discrete end steps never spill past the build boundary. */
export function keyframePercent(fraction: number): number {
  return Math.floor(fraction * 100_000_000) / 1_000_000;
}

export interface KeyStep {
  /** Percentage position in the keyframes (0..100). */
  readonly pct: number;
  /** Number of exposed cells from the bottom at this step. */
  readonly exposed: number;
}

/**
 * Builds the exposed-cell schedule for a single column, shared by every
 * contributions animation style. Each entry is a discrete, grid-aligned step.
 */
export function columnSchedule(params: {
  style: AnimationConfig['style'];
  easing: EasingName;
  height: number;
  index: number;
  columns: number;
  rows: number;
  window: { startFrac: number; endFrac: number };
  /** Global diagonal wave fraction per column (for cascade). */
  cascadeColumnFrac: number;
  cascadeRowFrac: number;
}): KeyStep[] {
  const { style, easing, height, window } = params;
  const startPct = keyframePercent(window.startFrac);
  const endPct = keyframePercent(window.endFrac);
  const steps: KeyStep[] = [{ pct: 0, exposed: 0 }];
  if (startPct > 0) {
    steps.push({ pct: startPct, exposed: 0 });
  }

  if (height <= 0) {
    steps.push({ pct: 100, exposed: 0 });
    return steps;
  }

  if (style === 'reveal') {
    // Whole column appears at the window end, after the initial delay.
    steps.push({ pct: endPct, exposed: height });
    steps.push({ pct: 100, exposed: height });
    return dedupe(steps);
  }

  if (style === 'cascade') {
    // Bottom-up per-cell reveal on a shared diagonal wave.
    const span = Math.max(0.0001, endPct - startPct);
    for (let k = 1; k <= height; k += 1) {
      const local = inverseEasing(easing, k / params.rows);
      const pct = keyframePercent((startPct + local * span) / 100);
      steps.push({ pct, exposed: k });
    }
    steps.push({ pct: 100, exposed: height });
    return dedupe(steps);
  }

  // grow: per-cell eased stepping within the column window.
  const span = Math.max(0.0001, endPct - startPct);
  for (let k = 1; k <= height; k += 1) {
    const t = inverseEasing(easing, k / height);
    const pct = keyframePercent((startPct + t * span) / 100);
    steps.push({ pct, exposed: k });
  }
  steps.push({ pct: 100, exposed: height });
  return dedupe(steps);
}

function dedupe(steps: KeyStep[]): KeyStep[] {
  const out: KeyStep[] = [];
  for (const step of steps) {
    const last = out[out.length - 1];
    if (last && last.pct === step.pct) {
      // Keep the later (higher exposed) value at the same pct.
      out[out.length - 1] = step;
      continue;
    }
    if (last && last.exposed === step.exposed && step.pct !== 100) {
      continue; // redundant hold; steps() carries the value forward
    }
    out.push(step);
  }
  return out;
}

/** CSS keyframes body for a column translate schedule. */
export function keyframesForColumn(
  name: string,
  steps: KeyStep[],
  rows: number,
  pitch: number,
): string {
  const frames = steps
    .map((step) => {
      const ty = (rows - step.exposed) * pitch;
      return (
        `${step.pct}%{transform:translateY(${ty}px);` +
        `animation-timing-function:steps(1,end);}`
      );
    })
    .join('');
  return `@keyframes ${name}{${frames}}`;
}
