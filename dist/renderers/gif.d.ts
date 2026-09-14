import { type ChartModelInput } from '../config/defaults.js';
import { type FrameOptions } from './frames.js';
export interface GifResult {
    readonly buffer: Uint8Array;
    readonly width: number;
    readonly height: number;
    readonly frameCount: number;
    readonly loop: boolean;
    readonly bytes: number;
}
export interface GifOptions extends FrameOptions {
    /** Rasterized frame width in px; defaults to the chart's configured width. */
    readonly width?: number;
}
/**
 * Renders a chart model to an animated GIF.
 *
 * Frames are produced from the chart's own animation schedule, rasterized with
 * resvg (a WebAssembly SVG renderer), and encoded with a shared 256-colour
 * palette. Because raster back-ends do not evaluate CSS custom properties or
 * media queries, each frame is flattened to its concrete theme colours first,
 * so a GIF always paints one fixed theme (light unless `theme: dark`).
 */
export declare function renderChartGif(input: ChartModelInput, options?: GifOptions): Promise<GifResult>;
