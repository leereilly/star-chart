import type { ChartModel } from '../models/index.js';
import { type ChartModelInput } from '../config/defaults.js';
export { RenderError } from './shared.js';
/**
 * A single frozen animation frame: the number of exposed cells (from the
 * bottom) for each column at one moment of the build. Consumed by the GIF
 * pipeline to rasterize the CSS animation into discrete frames.
 */
export interface ContribFrame {
    readonly exposed: readonly number[];
}
export interface ContribGeometry {
    readonly cols: number;
    readonly rows: number;
    readonly pitch: number;
    readonly cell: number;
    readonly gap: number;
    readonly radius: number;
    readonly gridWidth: number;
    readonly gridHeight: number;
}
/** Computes contribution grid geometry, honouring auto/explicit cell config. */
export declare function contribGeometry(input: ChartModelInput): ContribGeometry;
/**
 * Computes the integer cell height for a cumulative value under the selected
 * scale. Positive values always get at least one cell; the window maximum
 * fills all rows.
 */
export declare function columnHeight(input: ChartModelInput, cumulative: number): number;
/** Colour class for the k-th cell from the top of a filled column. */
export declare function tipClassFromTop(kFromTop: number): string;
/** Renders the contributions chart. */
export declare function renderContributions(model: ChartModel, frame?: ContribFrame): string;
