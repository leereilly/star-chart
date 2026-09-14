import type { ChartModel } from '../models/index.js';
export declare function renderStepLine(model: ChartModel): string;
/** A value heatmap: every occupied tile in a column has the same intensity. */
export declare function renderGrid(model: ChartModel): string;
export declare function renderMilestoneScatter(model: ChartModel): string;
export declare function renderMilestoneArea(model: ChartModel): string;
export declare function renderClusteredBar(model: ChartModel): string;
export declare function renderNeonGlow(model: ChartModel): string;
export declare function renderNeonGlowStream(model: ChartModel): string;
export declare function renderAsciiTerminal(model: ChartModel): string;
export declare function renderHandDrawn(model: ChartModel): string;
