import type { ChartModel, RepositorySeries } from '../models/index.js';
export interface PlotPoint {
    readonly index: number;
    readonly x: number;
    readonly y: number;
    readonly time: number;
    readonly cumulative: number;
    readonly added: number;
}
export interface PlotFrame {
    readonly width: number;
    readonly height: number;
    readonly padX: number;
    readonly padTop: number;
    readonly headerHeight: number;
    readonly plotLeft: number;
    readonly plotTop: number;
    readonly plotWidth: number;
    readonly plotHeight: number;
    readonly datesHeight: number;
    readonly footerHeight: number;
    readonly points: PlotPoint[];
    readonly yTicks: Array<{
        value: number;
        y: number;
    }>;
    readonly yMin: number;
    readonly yMax: number;
    readonly xForIndex: (index: number) => number;
    readonly xForTime: (time: number) => number;
    readonly yForValue: (value: number) => number;
    readonly baselineY: number;
    readonly barWidth: number;
    /** Font size in px for the y-axis tick labels. */
    readonly axisFontSize: number;
    readonly showXAxis: boolean;
    readonly sketchAxes?: boolean;
}
export interface FrameOptions {
    /** Historical style hint; the resolved showYAxis configuration takes precedence. */
    readonly axis: boolean;
    /** Reserve space for date labels + logo. */
    readonly compact: boolean;
    readonly centered?: boolean;
    readonly series?: readonly RepositorySeries[] | undefined;
    readonly legendHeight?: number;
    /** Use the complete observation interval, not just bucket endpoints. */
    readonly observationDomain?: boolean;
    /** Keep glow and sketch strokes inside the SVG without clipping them. */
    readonly inset?: number;
}
/** Builds a conventional-chart plotting frame with genuine D3 scales. */
export declare function buildFrame(model: ChartModel, options: FrameOptions): PlotFrame;
export type AxisFrame = Pick<PlotFrame, 'plotLeft' | 'plotTop' | 'plotWidth' | 'baselineY' | 'axisFontSize' | 'padX' | 'yTicks' | 'showXAxis' | 'sketchAxes'>;
export declare function renderXAxis(frame: AxisFrame): string;
/** Renders a light y-axis, retaining precision when compact labels collide. */
export declare function renderYAxis(frame: AxisFrame): string;
