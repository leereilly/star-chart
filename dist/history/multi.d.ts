import type { ChartModel, RepositoryHistorySource } from '../models/index.js';
import type { ChartConfigInput } from '../config/defaults.js';
import { type BuildOptions } from './model.js';
/**
 * Align the complete histories first, then select and bucket every series on
 * the aggregate spine. Independent trailing windows would compare different
 * dates and lose carry-forward baselines for younger/shorter repositories.
 */
export declare function buildMultiRepositoryChartModel(config: ChartConfigInput, sources: readonly RepositoryHistorySource[], options: BuildOptions): ChartModel;
