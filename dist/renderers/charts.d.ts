import { type CurveFactory } from 'd3-shape';
import type { AnimationConfig, ChartModel } from '../models/index.js';
import { type Layout } from './shared.js';
import { type PlotFrame } from './conventional.js';
import { type Timeline } from './animation.js';
export declare function chartCurve(model: ChartModel): CurveFactory;
export declare function toLayout(frame: PlotFrame): Layout;
export declare function pointTitles(model: ChartModel, frame: PlotFrame): string;
/** LTR clip-wipe animation shared by reveal/cascade/area/bar styles. */
export declare function wipeClip(frame: PlotFrame, id: (name: string) => string, anim: AnimationConfig, timeline: Timeline, padding?: number): {
    clipId: string;
    defs: string;
    css: string;
};
export declare function commonBody(model: ChartModel, frame: PlotFrame, plot: string, xAxis?: string): string;
/** Cumulative line chart. */
export declare function renderLine(model: ChartModel): string;
/** Compact sparkline. */
export declare function renderSparkline(model: ChartModel): string;
/** Cumulative area chart. */
export declare function renderArea(model: ChartModel): string;
/** Cumulative bar chart. */
export declare function renderBar(model: ChartModel): string;
