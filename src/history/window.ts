import type {
  ChartConfig,
  NormalizedHistory,
  WindowSelection,
} from '../models/index.js';

/**
 * Selects the trailing window of weeks according to the resolved configuration.
 *
 * The baseline is the cumulative additions immediately before the window,
 * computed over the full normalized history so prefix sums remain correct.
 */
export function selectWindow(
  history: NormalizedHistory,
  config: ChartConfig,
): WindowSelection {
  const total = history.weeks.length;
  if (total === 0) {
    return {
      weeks: [],
      cumulative: [],
      baseline: 0,
      windowAdded: 0,
      hasSyntheticWeeks: history.hasSyntheticWeeks,
    };
  }

  const count = Math.min(config.weeks, total);
  const startIndex = total - count;
  const baseline =
    startIndex > 0 ? (history.cumulative[startIndex - 1] ?? 0) : 0;

  const weeks = history.weeks.slice(startIndex);
  const cumulative = history.cumulative.slice(startIndex);
  const windowAdded = weeks.reduce((sum, week) => sum + week.added, 0);

  return {
    weeks,
    cumulative,
    baseline,
    windowAdded,
    hasSyntheticWeeks: history.hasSyntheticWeeks,
  };
}
