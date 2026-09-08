import type { ChartModel, NormalizedHistory, RepositoryMetadata } from '../models/index.js';
import { type ChartConfigInput } from '../config/defaults.js';
export interface BuildOptions {
    /** Injected clock (epoch ms) used for empty-window fallbacks. */
    readonly asOf: number;
}
/**
 * Builds the immutable, renderer-ready chart model.
 *
 * Accepts a config with omitted block dimensions (programmatic callers) and
 * normalizes it before bucketing; the returned model always carries a
 * complete {@link ChartConfig}.
 */
export declare function buildChartModel(rawConfig: ChartConfigInput, metadata: RepositoryMetadata, history: NormalizedHistory, options: BuildOptions): ChartModel;
