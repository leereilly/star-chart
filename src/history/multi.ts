import type {
  ChartModel,
  RepositoryHistorySource,
  RepositorySeries,
  WeekPoint,
} from '../models/index.js';
import type { ChartConfigInput } from '../config/defaults.js';
import { utcWeekStart } from '../utils/dates.js';
import { aggregateHistories, aggregateMetadata } from './aggregate.js';
import { buildChartModel, type BuildOptions } from './model.js';

/**
 * Align the complete histories first, then select and bucket every series on
 * the aggregate spine. Independent trailing windows would compare different
 * dates and lose carry-forward baselines for younger/shorter repositories.
 */
export function buildMultiRepositoryChartModel(
  config: ChartConfigInput,
  sources: readonly RepositoryHistorySource[],
  options: BuildOptions,
): ChartModel {
  const metadata = aggregateMetadata(sources.map((source) => source.metadata));
  const history = aggregateHistories(sources.map((source) => source.history));
  const model = buildChartModel(config, metadata, history, options);
  const series: RepositorySeries[] = sources.map((source) => {
    // The single-source aggregate deliberately preserves its original slots,
    // including observations whose timestamp offsets share a calendar week.
    if (sources.length === 1) return repositorySeries(model);
    const byWeek = new Map<number, { added: number; synthetic: boolean }>();
    for (const week of source.history.weeks) {
      const key = utcWeekStart(week.time);
      const previous = byWeek.get(key);
      byWeek.set(key, {
        added: (previous?.added ?? 0) + week.added,
        synthetic: previous
          ? previous.synthetic && week.synthetic
          : week.synthetic,
      });
    }
    const keys = [...byWeek.keys()];
    const first = Math.min(...keys);
    const last = Math.max(...keys);
    let running = 0;
    const cumulative: number[] = [];
    const weeks: WeekPoint[] = history.weeks.map((slot) => {
      const key = utcWeekStart(slot.time);
      const observation = byWeek.get(key);
      const added = observation?.added ?? 0;
      running += added;
      cumulative.push(running);
      return {
        time: slot.time,
        timestamp: slot.timestamp,
        added,
        synthetic:
          observation?.synthetic ??
          (key > first &&
            key < last &&
            key >= utcWeekStart(Date.parse(source.metadata.createdAt))),
      };
    });
    const aligned = buildChartModel(
      model.config,
      source.metadata,
      {
        weeks,
        cumulative,
        totalAdded: running,
        hasSyntheticWeeks:
          source.history.hasSyntheticWeeks || weeks.some((w) => w.synthetic),
      },
      options,
    );
    return repositorySeries(aligned);
  });
  return { ...model, series };
}

function repositorySeries(model: ChartModel): RepositorySeries {
  return {
    metadata: model.metadata,
    buckets: model.buckets,
    selectedWeeks: model.selectedWeeks,
    baseline: model.baseline,
    windowMax: model.windowMax,
    hasSyntheticWeeks: model.hasSyntheticWeeks,
  };
}
