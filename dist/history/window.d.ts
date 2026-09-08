import type { ChartConfig, NormalizedHistory, WindowSelection } from '../models/index.js';
/**
 * Selects the trailing window of weeks according to the resolved configuration.
 *
 * The baseline is the cumulative additions immediately before the window,
 * computed over the full normalized history so prefix sums remain correct.
 */
export declare function selectWindow(history: NormalizedHistory, config: ChartConfig): WindowSelection;
