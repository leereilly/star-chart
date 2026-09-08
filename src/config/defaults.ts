/**
 * Central defaults for block dimensions and axis label sizing, plus the
 * normalization applied to programmatic input.
 *
 * The Action always supplies `columns`/`rows`/`axis_font_size` via
 * {@link parseInputs}, but library consumers of `dist/lib.js` may build a
 * config object by hand and omit them. Every exported build/render entry point funnels its config
 * through {@link normalizeChartConfig} so those callers get the documented
 * defaults instead of NaN geometry or empty output.
 */

import type {
  ChartConfig,
  ChartModel,
  RepositoryRef,
  WeekPoint,
} from '../models/index.js';

/** Default number of horizontal display buckets. */
export const DEFAULT_COLUMNS = 52;

/** Default number of vertical levels in tiled and terminal charts. */
export const DEFAULT_ROWS = 26;

/** Default px font size for date and y-axis tick labels. */
export const DEFAULT_AXIS_FONT_SIZE = 10;

/** Dual-theme rendering is opt-in. */
export const DEFAULT_DUAL_THEME = false;

/** Maximum number of repositories that may be aggregated into one chart. */
export const MAX_REPOSITORIES = 20;

/**
 * Reads the aggregated repository list from a config, falling back to the
 * single {@link ChartConfig.repository} when the list is absent or empty.
 */
export function configRepositories(
  config: Pick<ChartConfig, 'repository' | 'repositories'>,
): readonly RepositoryRef[] {
  const list = config.repositories;
  return list && list.length > 0 ? list : [config.repository];
}

/** Reads the dual-theme flag, defaulting to {@link DEFAULT_DUAL_THEME}. */
export function configDualTheme(
  config: Pick<ChartConfig, 'dualTheme'>,
): boolean {
  return config.dualTheme ?? DEFAULT_DUAL_THEME;
}

/**
 * Public config shape accepted by the programmatic API: identical to
 * {@link ChartConfig} except block dimensions, axis font size, and visibility
 * flags may be omitted. Missing flags use the same style defaults as inputs.
 */
export type ChartConfigInput = Omit<
  ChartConfig,
  'columns' | 'rows' | 'axisFontSize' | 'showXAxis' | 'showYAxis' | 'showLegend'
> & {
  readonly columns?: number | null;
  readonly rows?: number | null;
  readonly axisFontSize?: number | null;
  readonly showXAxis?: boolean;
  readonly showYAxis?: boolean;
  readonly showLegend?: boolean;
};

/**
 * {@link ChartModel} carrying a possibly under-specified config. The
 * statistics derived from the selected source weeks may also be omitted by
 * callers that assemble a model by hand.
 */
export type ChartModelInput = Omit<
  ChartModel,
  'config' | 'selectedWeeks' | 'peakGain'
> & {
  readonly config: ChartConfigInput;
  readonly selectedWeeks?: readonly WeekPoint[];
  readonly peakGain?: number;
};

/**
 * Fills in missing dimensions, axis font size and axis/legend visibility. Explicitly supplied
 * finite numbers are passed through untouched so existing range validation
 * still applies.
 */
export function normalizeChartConfig(config: ChartConfigInput): ChartConfig {
  const showXAxis = config.showXAxis ?? true;
  const showYAxis = config.showYAxis ?? config.style !== 'sparkline';
  const showLegend = config.showLegend ?? config.style !== 'sparkline';
  const columns = resolveDimension(config.columns, DEFAULT_COLUMNS);
  const rows = resolveDimension(config.rows, DEFAULT_ROWS);
  const axisFontSize = resolveDimension(
    config.axisFontSize,
    DEFAULT_AXIS_FONT_SIZE,
  );
  if (
    columns === config.columns &&
    rows === config.rows &&
    axisFontSize === config.axisFontSize &&
    showXAxis === config.showXAxis &&
    showYAxis === config.showYAxis &&
    showLegend === config.showLegend
  ) {
    return config as ChartConfig;
  }
  return {
    ...config,
    columns,
    rows,
    axisFontSize,
    showXAxis,
    showYAxis,
    showLegend,
  };
}

/** Applies {@link normalizeChartConfig} to a model, preserving identity. */
export function normalizeChartModel(model: ChartModelInput): ChartModel {
  const config = normalizeChartConfig(model.config);
  if (
    config === model.config &&
    model.selectedWeeks !== undefined &&
    model.peakGain !== undefined
  ) {
    return model as ChartModel;
  }
  const selectedWeeks = model.selectedWeeks ?? [];
  return {
    ...model,
    config,
    selectedWeeks,
    peakGain: model.peakGain ?? peakOf(selectedWeeks),
  };
}

function peakOf(weeks: readonly WeekPoint[]): number {
  return weeks.reduce((max, week) => Math.max(max, week.added), 0);
}

function resolveDimension(
  value: number | null | undefined,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
