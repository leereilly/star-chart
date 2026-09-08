import type { ChartModel, ChartStyle } from '../models/index.js';
import { type ChartModelInput } from '../config/defaults.js';
export type Renderer = (model: ChartModel) => string;
/** Returns the registered renderer for a style. */
export declare function getRenderer(style: ChartStyle): Renderer;
/** Byte ceilings for produced SVGs. */
export declare const SIZE_LIMITS: {
    readonly staticWarn: number;
    readonly animatedWarn: number;
    readonly hardMax: number;
};
export interface RenderOutput {
    readonly svg: string;
    readonly bytes: number;
}
/**
 * Renders the chart model to SVG and enforces the hard size ceiling. Callers
 * may inspect {@link RenderOutput.bytes} against the soft warning thresholds.
 *
 * Models supplied programmatically may omit block dimensions; they are
 * defaulted before the renderer runs.
 */
export declare function renderChart(input: ChartModelInput): RenderOutput;
