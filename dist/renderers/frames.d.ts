import type { ChartModel } from '../models/index.js';
import { type ChartModelInput } from '../config/defaults.js';
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
/** Resolves the concrete theme a raster frame should paint. */
export declare function frameTheme(model: ChartModel): 'light' | 'dark';
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
export declare function buildFrameSequence(input: ChartModelInput, options?: FrameOptions): FrameSequence;
