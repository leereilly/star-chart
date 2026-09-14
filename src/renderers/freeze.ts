import type { AnimationConfig } from '../models/index.js';
import { EASINGS, inverseEasing, type Timeline } from './animation.js';

/**
 * Freezing turns a chart's CSS animation into a single static moment that a
 * raster back-end (resvg) can paint. Renderers emit CSS `@keyframes`/`animation`
 * that resvg ignores, so a frozen render instead bakes the animated state at one
 * cycle position into plain SVG presentation attributes (a partial clip rect, an
 * absolute `stroke-dasharray`, a scaled bar rect, a text `opacity`).
 *
 * The position is expressed as a fraction of the whole animation cycle, on the
 * same axis as the keyframes (`buildFrac = buildSeconds / cycleSeconds`
 * separates the active build from any loop pause). A single scalar is enough:
 * each per-element window (cascade steps, per-bar grow) is recomputed locally
 * from the shared metadata, exactly as the CSS keyframes do.
 *
 * Rendering is synchronous and single-threaded, so a module-scoped current
 * value is a safe ambient context: {@link withFreeze} sets it around one render
 * and restores it afterwards. When it is `null`, every renderer behaves exactly
 * as before, keeping non-frozen (SVG) output byte-for-byte identical.
 */
let currentFreeze: number | null = null;

/** The active freeze position (cycle fraction 0..1), or `null` when not frozen. */
export function freezeProgress(): number | null {
  return currentFreeze;
}

/** True while a frozen render is in progress. */
export function isFrozen(): boolean {
  return currentFreeze !== null;
}

/** Runs `fn` with the freeze position set to `cycleFraction`, then restores it. */
export function withFreeze<T>(cycleFraction: number, fn: () => T): T {
  const previous = currentFreeze;
  currentFreeze = clamp01(cycleFraction);
  try {
    return fn();
  } finally {
    currentFreeze = previous;
  }
}

/** Fraction of the cycle spent in the active build (before any loop pause). */
function buildFraction(timeline: Timeline): number {
  if (timeline.cycleSeconds <= 0) {
    return 1;
  }
  return timeline.buildSeconds / timeline.cycleSeconds;
}

/**
 * The clip-wipe scale (0..1) at the current freeze position, matching the CSS
 * `wipeClip` keyframes: eased for reveal/grow, discrete for cascade, and a hard
 * step for a simultaneous reveal (`steps(1,end)`).
 */
export function wipeScaleAt(
  anim: AnimationConfig,
  timeline: Timeline,
  pointCount: number,
  cycleFraction: number,
): number {
  const bf = buildFraction(timeline);
  if (bf <= 0) {
    return 1;
  }
  const local = clamp01(cycleFraction / bf);
  const simultaneous = anim.direction === 'simultaneous';

  if (anim.style === 'cascade') {
    const count = Math.max(1, pointCount);
    let scale = 0;
    for (let i = 0; i <= count; i += 1) {
      if (inverseEasing(anim.easing, i / count) <= local) {
        scale = i / count;
      }
    }
    return scale;
  }
  if (simultaneous && anim.style === 'reveal') {
    return local >= 1 ? 1 : 0;
  }
  return EASINGS[anim.easing](local);
}

/**
 * The eased draw fraction (0..1) of a stroke-drawn line at the current freeze
 * position, matching the `stroke-dashoffset` 1→0 keyframes.
 */
export function strokeDrawFractionAt(
  anim: AnimationConfig,
  timeline: Timeline,
  cycleFraction: number,
): number {
  const bf = buildFraction(timeline);
  if (bf <= 0) {
    return 1;
  }
  return EASINGS[anim.easing](clamp01(cycleFraction / bf));
}

/**
 * The vertical grow scale (0..1) of bar `index` at the current freeze position,
 * matching each bar's per-column `scaleY(0)`→`scaleY(1)` window.
 */
export function barGrowScaleAt(
  anim: AnimationConfig,
  window: { startFrac: number; endFrac: number },
  cycleFraction: number,
): number {
  const span = window.endFrac - window.startFrac;
  if (span <= 0) {
    return cycleFraction >= window.endFrac ? 1 : 0;
  }
  const local = clamp01((cycleFraction - window.startFrac) / span);
  return EASINGS[anim.easing](local);
}

/**
 * The header total's reveal opacity (0..1) at the current freeze position,
 * matching the `totalRevealCss` fade over the final tenth of the build.
 */
export function totalRevealOpacityAt(
  timeline: Timeline,
  cycleFraction: number,
): number {
  const endFrac = buildFraction(timeline);
  const startFrac = endFrac * 0.9;
  const span = endFrac - startFrac;
  if (span <= 0) {
    return cycleFraction >= endFrac ? 1 : 0;
  }
  return clamp01((cycleFraction - startFrac) / span);
}

/**
 * Approximate user-space length of an SVG path `d` string. Only the command set
 * emitted by d3-shape generators is handled (absolute M/L/H/V/C plus Z); cubic
 * segments are flattened by sampling. Used to convert a normalized draw fraction
 * into the absolute `stroke-dasharray` length resvg understands (it ignores
 * `pathLength`).
 */
export function svgPathLength(d: string): number {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) {
    return 0;
  }
  let i = 0;
  let command = '';
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let length = 0;
  const next = (): number => Number(tokens[i++] ?? '0');
  while (i < tokens.length) {
    const token = tokens[i] ?? '';
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      i += 1;
    }
    switch (command) {
      case 'M': {
        cx = next();
        cy = next();
        startX = cx;
        startY = cy;
        command = 'L'; // subsequent implicit pairs are line-tos
        break;
      }
      case 'L': {
        const x = next();
        const y = next();
        length += Math.hypot(x - cx, y - cy);
        cx = x;
        cy = y;
        break;
      }
      case 'H': {
        const x = next();
        length += Math.abs(x - cx);
        cx = x;
        break;
      }
      case 'V': {
        const y = next();
        length += Math.abs(y - cy);
        cy = y;
        break;
      }
      case 'C': {
        const x1 = next();
        const y1 = next();
        const x2 = next();
        const y2 = next();
        const x = next();
        const y = next();
        length += cubicLength(cx, cy, x1, y1, x2, y2, x, y);
        cx = x;
        cy = y;
        break;
      }
      case 'Z':
      case 'z': {
        length += Math.hypot(startX - cx, startY - cy);
        cx = startX;
        cy = startY;
        break;
      }
      default: {
        i += 1; // skip anything unexpected rather than loop forever
      }
    }
  }
  return length;
}

function cubicLength(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): number {
  const steps = 24;
  let length = 0;
  let px = x0;
  let py = y0;
  for (let s = 1; s <= steps; s += 1) {
    const t = s / steps;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const dd = t * t * t;
    const x = a * x0 + b * x1 + c * x2 + dd * x3;
    const y = a * y0 + b * y1 + c * y2 + dd * y3;
    length += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return length;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
