import type { AnimationConfig } from '../models/index.js';
import { type Timeline } from './animation.js';
/** The active freeze position (cycle fraction 0..1), or `null` when not frozen. */
export declare function freezeProgress(): number | null;
/** True while a frozen render is in progress. */
export declare function isFrozen(): boolean;
/** Runs `fn` with the freeze position set to `cycleFraction`, then restores it. */
export declare function withFreeze<T>(cycleFraction: number, fn: () => T): T;
/**
 * The clip-wipe scale (0..1) at the current freeze position, matching the CSS
 * `wipeClip` keyframes: eased for reveal/grow, discrete for cascade, and a hard
 * step for a simultaneous reveal (`steps(1,end)`).
 */
export declare function wipeScaleAt(anim: AnimationConfig, timeline: Timeline, pointCount: number, cycleFraction: number): number;
/**
 * The eased draw fraction (0..1) of a stroke-drawn line at the current freeze
 * position, matching the `stroke-dashoffset` 1→0 keyframes.
 */
export declare function strokeDrawFractionAt(anim: AnimationConfig, timeline: Timeline, cycleFraction: number): number;
/**
 * The vertical grow scale (0..1) of bar `index` at the current freeze position,
 * matching each bar's per-column `scaleY(0)`→`scaleY(1)` window.
 */
export declare function barGrowScaleAt(anim: AnimationConfig, window: {
    startFrac: number;
    endFrac: number;
}, cycleFraction: number): number;
/**
 * The header total's reveal opacity (0..1) at the current freeze position,
 * matching the `totalRevealCss` fade over the final tenth of the build.
 */
export declare function totalRevealOpacityAt(timeline: Timeline, cycleFraction: number): number;
/**
 * Approximate user-space length of an SVG path `d` string. Only the command set
 * emitted by d3-shape generators is handled (absolute M/L/H/V/C plus Z); cubic
 * segments are flattened by sampling. Used to convert a normalized draw fraction
 * into the absolute `stroke-dasharray` length resvg understands (it ignores
 * `pathLength`).
 */
export declare function svgPathLength(d: string): number;
