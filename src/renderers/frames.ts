import type { ChartModel } from '../models/index.js';
import {
  normalizeChartModel,
  type ChartModelInput,
} from '../config/defaults.js';
import { getRenderer } from './index.js';
import {
  columnHeight,
  contribGeometry,
  renderContributions,
} from './contributions.js';
import {
  columnSchedule,
  columnWindow,
  resolveTimeline,
  type KeyStep,
} from './animation.js';
import { withFreeze } from './freeze.js';

/** One rendered animation frame: a standalone SVG and its on-screen duration. */
export interface ChartFrame {
  readonly svg: string;
  /** How long to hold this frame, in milliseconds. */
  readonly delayMs: number;
}

/** A complete, ordered sequence of frames plus playback metadata. */
export interface FrameSequence {
  readonly frames: readonly ChartFrame[];
  /** True when the sequence should repeat forever (animation `loop`). */
  readonly loop: boolean;
  /** The concrete theme every frame was rendered for. */
  readonly theme: 'light' | 'dark';
}

export interface FrameOptions {
  /** Target frames per second for animated sequences (default 20). */
  readonly fps?: number;
}

const DEFAULT_FPS = 20;
const MIN_FPS = 1;
const MAX_FPS = 50;
/** Hold a single static frame for two seconds before any loop restarts. */
const STATIC_DELAY_MS = 2000;

/** Resolves the concrete theme a raster frame should paint. */
export function frameTheme(model: ChartModel): 'light' | 'dark' {
  return model.config.theme === 'dark' ? 'dark' : 'light';
}

/**
 * Builds the ordered SVG frames that reproduce a chart's CSS animation as a
 * discrete sequence suitable for raster encoding (GIF).
 *
 * Every style animates. Contributions charts are frozen frame-by-frame from the
 * exact per-column build schedule the animated SVG uses. All other styles are
 * frozen through the shared {@link withFreeze} context: each frame re-renders
 * the chart at one cycle position with the CSS animation baked into static SVG
 * attributes (partial clip-wipe, absolute `stroke-dasharray` draw, scaled bar
 * geometry, faded total), reproducing the same stroke-draw, clip-wipe and
 * transform/scale techniques the animated SVG uses. A chart with animation
 * disabled yields a single finished-chart frame (still a valid, one-frame
 * sequence). Playback rules (`once` plays through then holds the finished chart;
 * `loop` samples one seamless build-plus-pause cycle and omits the one-time
 * delay) are identical across styles.
 */
export function buildFrameSequence(
  input: ChartModelInput,
  options: FrameOptions = {},
): FrameSequence {
  const model = normalizeChartModel(input);
  const theme = frameTheme(model);
  const anim = model.config.animation;

  if (model.config.style !== 'contributions') {
    return buildGenericSequence(model, theme, options);
  }

  const geo = contribGeometry(model);
  const heights: number[] = [];
  for (let j = 0; j < geo.cols; j += 1) {
    const bucket = model.buckets[j];
    heights.push(bucket ? columnHeight(model, bucket.cumulative) : 0);
  }

  if (anim.mode === 'none') {
    // A still contributions chart: one frame at full height. Routed through the
    // frozen-frame path so columns use the SVG `transform` attribute resvg can
    // apply (the CSS `transform` property is ignored by raster back-ends).
    const svg = renderContributions(model, { exposed: heights });
    return { frames: [{ svg, delayMs: STATIC_DELAY_MS }], loop: false, theme };
  }

  const fps = clampFps(options.fps ?? DEFAULT_FPS);
  const timeline = resolveTimeline(anim);

  // Per-column exposed-cell schedule, identical to the animated renderer.
  const schedules: KeyStep[][] = [];
  for (let j = 0; j < geo.cols; j += 1) {
    const h = heights[j] ?? 0;
    if (h <= 0) {
      schedules.push([{ pct: 0, exposed: 0 }]);
      continue;
    }
    const window = columnWindow(j, geo.cols, anim, timeline);
    schedules.push(
      columnSchedule({
        style: anim.style,
        easing: anim.easing,
        height: h,
        index: j,
        columns: geo.cols,
        rows: geo.rows,
        window,
        cascadeColumnFrac: 0,
        cascadeRowFrac: 0,
      }),
    );
  }

  const loop = anim.mode === 'loop';
  const delayMs = Math.max(20, Math.round(1000 / fps));

  const frame = (pct: number, holdMs: number = delayMs): ChartFrame => ({
    // `pct` is a position on the cycle (0–100); the freeze context expresses it
    // as a fraction so `renderHeader` bakes the `animate_total` reveal opacity at
    // the same cycle position the CSS keyframes would (contributions frames use
    // their own exposed-cell path and never enter the generic freeze branch).
    svg: withFreeze(pct / 100, () =>
      renderContributions(model, {
        exposed: schedules.map((schedule) => exposedAt(schedule, pct)),
      }),
    ),
    delayMs: holdMs,
  });

  const frames: ChartFrame[] = [];

  if (loop) {
    // A GIF cannot apply an animation delay only on the first play, so the
    // one-time `delaySeconds` is intentionally omitted here: baking it into the
    // sampled cycle would replay an empty gap on every repeat. We sample one
    // seamless build-plus-pause cycle; the pause naturally holds the finished
    // chart before the loop restarts.
    const span = timeline.cycleSeconds;
    const frameCount = Math.max(2, Math.round(span * fps));
    for (let i = 0; i < frameCount; i += 1) {
      const seconds = (i / frameCount) * span; // [0, span)
      frames.push(frame((seconds / timeline.cycleSeconds) * 100));
    }
    return { frames, loop, theme };
  }

  // `once`: honour the one-time initial delay, play the whole build, then append
  // an explicit terminal frame that is exactly the finished chart, held long
  // enough to read regardless of the configured delay/duration/pause.
  const span = anim.delaySeconds + timeline.cycleSeconds;
  const buildFrames = Math.max(1, Math.round(span * fps));
  for (let i = 0; i < buildFrames; i += 1) {
    const seconds = (i / buildFrames) * span; // [0, span)
    frames.push(frame(cyclePercentOnce(seconds, anim.delaySeconds, timeline)));
  }
  // Terminal completed frame: the finished chart with the total fully revealed
  // (freeze at cycle end so `animate_total` bakes opacity 1, matching the CSS
  // `both` fill that holds the reveal after the build).
  frames.push({
    svg: withFreeze(1, () => renderContributions(model, { exposed: heights })),
    delayMs: STATIC_DELAY_MS,
  });

  return { frames, loop, theme };
}

/**
 * Builds a frame sequence for a non-contributions style by re-rendering the
 * chart at successive cycle positions through the shared freeze context. The
 * timeline, delay handling and terminal-hold rules mirror the contributions
 * path so every style plays back identically.
 */
function buildGenericSequence(
  model: ChartModel,
  theme: 'light' | 'dark',
  options: FrameOptions,
): FrameSequence {
  const anim = model.config.animation;
  const renderer = getRenderer(model.config.style);

  const still = staticModel(model);

  if (anim.mode === 'none') {
    return {
      frames: [{ svg: renderer(still), delayMs: STATIC_DELAY_MS }],
      loop: false,
      theme,
    };
  }

  const fps = clampFps(options.fps ?? DEFAULT_FPS);
  const timeline = resolveTimeline(anim);
  const delayMs = Math.max(20, Math.round(1000 / fps));
  const loop = anim.mode === 'loop';

  const frozen = (cycleFrac: number): ChartFrame => ({
    svg: withFreeze(cycleFrac, () => renderer(model)),
    delayMs,
  });

  const frames: ChartFrame[] = [];

  if (loop) {
    // Sample one seamless build-plus-pause cycle. The one-time delay is omitted
    // (a GIF cannot delay only the first play); the pause portion of the cycle
    // naturally holds the finished chart before the loop restarts.
    const span = timeline.cycleSeconds;
    const frameCount = Math.max(2, Math.round(span * fps));
    for (let i = 0; i < frameCount; i += 1) {
      const seconds = (i / frameCount) * span; // [0, span)
      frames.push(frozen(seconds / timeline.cycleSeconds));
    }
    return { frames, loop, theme };
  }

  // `once`: honour the one-time delay, play the whole build, then append the
  // finished static chart held long enough to read.
  const span = anim.delaySeconds + timeline.cycleSeconds;
  const buildFrames = Math.max(1, Math.round(span * fps));
  for (let i = 0; i < buildFrames; i += 1) {
    const seconds = (i / buildFrames) * span; // [0, span)
    const effective = seconds - anim.delaySeconds;
    const cycleFrac =
      effective <= 0 ? 0 : Math.min(1, effective / timeline.cycleSeconds);
    frames.push(frozen(cycleFrac));
  }
  frames.push({ svg: renderer(still), delayMs: STATIC_DELAY_MS });

  return { frames, loop, theme };
}

/** A copy of the model with animation disabled, for a finished static frame. */
function staticModel(model: ChartModel): ChartModel {
  return {
    ...model,
    config: {
      ...model.config,
      animation: { ...model.config.animation, mode: 'none' },
    },
  };
}

/**
 * Maps wall-clock seconds to a position (0–100) within a non-looping build,
 * honouring the one-time delay and the CSS `both` fill so pre-delay frames sit
 * on 0% and a finished build holds at 100%.
 */
function cyclePercentOnce(
  seconds: number,
  delaySeconds: number,
  timeline: ReturnType<typeof resolveTimeline>,
): number {
  const effective = seconds - delaySeconds;
  if (effective <= 0) {
    return 0;
  }
  const fraction = Math.min(1, effective / timeline.cycleSeconds);
  return fraction * 100;
}

/**
 * Reads the exposed-cell count at cycle position `pct` under `steps(1, end)`
 * semantics: the value holds at the most recent keyframe until the next one.
 */
function exposedAt(schedule: readonly KeyStep[], pct: number): number {
  let exposed = 0;
  for (const step of schedule) {
    if (step.pct <= pct) {
      exposed = step.exposed;
    } else {
      break;
    }
  }
  return exposed;
}

function clampFps(fps: number): number {
  if (!Number.isFinite(fps)) {
    return DEFAULT_FPS;
  }
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps)));
}
