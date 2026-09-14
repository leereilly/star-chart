import type {
  ChartModel,
  NormalizedHistory,
  PeriodName,
  RepositoryMetadata,
} from '../models/index.js';
import {
  normalizeChartConfig,
  type ChartConfigInput,
} from '../config/defaults.js';
import { isoDate } from '../utils/dates.js';
import { bucketWindow } from './bucket.js';
import { selectWindow } from './window.js';

export interface BuildOptions {
  /** Injected clock (epoch ms) used for empty-window fallbacks. */
  readonly asOf: number;
}

const PERIOD_LABELS: Record<PeriodName, string> = {
  '3m': '3 months',
  '6m': '6 months',
  '1y': '1 year',
  '2y': '2 years',
  '5y': '5 years',
  all: 'all time',
};

/**
 * Builds the immutable, renderer-ready chart model.
 *
 * Accepts a config with omitted block dimensions (programmatic callers) and
 * normalizes it before bucketing; the returned model always carries a
 * complete {@link ChartConfig}.
 */
export function buildChartModel(
  rawConfig: ChartConfigInput,
  metadata: RepositoryMetadata,
  history: NormalizedHistory,
  options: BuildOptions,
): ChartModel {
  const config = normalizeChartConfig(rawConfig);
  const window = selectWindow(history, config);
  const buckets = bucketWindow(window, config.columns, window.baseline);

  const windowMax = buckets.reduce(
    (max, bucket) => Math.max(max, bucket.cumulative),
    window.baseline,
  );

  const firstWeek = window.weeks[0];
  const lastWeek = window.weeks[window.weeks.length - 1];
  const periodStart = firstWeek
    ? isoDate(firstWeek.time)
    : isoDate(Date.parse(metadata.createdAt));
  const periodEnd = lastWeek ? isoDate(lastWeek.time) : isoDate(options.asOf);

  const periodLabel = config.period
    ? PERIOD_LABELS[config.period]
    : `${config.weeks} weeks`;

  const isEmpty = history.totalAdded === 0;

  const peakGain = window.weeks.reduce(
    (max, week) => Math.max(max, week.added),
    0,
  );

  return {
    config,
    metadata,
    buckets,
    selectedWeeks: window.weeks,
    baseline: window.baseline,
    windowMax,
    windowAdded: window.windowAdded,
    peakGain,
    currentStars: metadata.stargazersCount,
    periodStart,
    periodEnd,
    periodLabel,
    hasSyntheticWeeks: window.hasSyntheticWeeks,
    isEmpty,
  };
}
