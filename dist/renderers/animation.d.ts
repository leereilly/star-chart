import type { AnimationConfig, EasingName } from '../models/index.js';
/** Simple deterministic easing functions over normalized time [0,1]. */
export declare const EASINGS: Record<EasingName, (f: number) => number>;
/** Inverse of the easing (time at which eased progress reaches `y`). */
export declare function inverseEasing(easing: EasingName, y: number): number;
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
export declare function resolveTimeline(anim: AnimationConfig): Timeline;
/**
 * Returns the [startFrac, endFrac] window (fractions of the cycle) during
 * which column `index` performs its build.
 */
export declare function columnWindow(index: number, columns: number, anim: AnimationConfig, timeline: Timeline): {
    startFrac: number;
    endFrac: number;
};
/** A build window with explicit pre-build and post-build holds. */
export declare function progressKeyframes(name: string, property: string, from: string, to: string, window: {
    startFrac: number;
    endFrac: number;
}): string;
/** Round down so discrete end steps never spill past the build boundary. */
export declare function keyframePercent(fraction: number): number;
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
export declare function columnSchedule(params: {
    style: AnimationConfig['style'];
    easing: EasingName;
    height: number;
    index: number;
    columns: number;
    rows: number;
    window: {
        startFrac: number;
        endFrac: number;
    };
    /** Global diagonal wave fraction per column (for cascade). */
    cascadeColumnFrac: number;
    cascadeRowFrac: number;
}): KeyStep[];
/** CSS keyframes body for a column translate schedule. */
export declare function keyframesForColumn(name: string, steps: KeyStep[], rows: number, pitch: number): string;
