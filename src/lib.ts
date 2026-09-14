/**
 * Side-effect-free programmatic API for Star Chart.
 *
 * Importing this module performs no I/O and does not touch `@actions/core`,
 * so it is safe to use in libraries and tests.
 */

export * from './models/index.js';
export { parseInputs, PERIOD_WEEKS } from './config/inputs.js';
export type { ParsedConfig, RawInputs, ParseOptions } from './config/inputs.js';
export { ConfigError, parseRepositories } from './config/validate.js';
export type { ParseRepositoriesOptions } from './config/validate.js';
export {
  DEFAULT_AXIS_FONT_SIZE,
  DEFAULT_COLUMNS,
  DEFAULT_DUAL_THEME,
  DEFAULT_ROWS,
  MAX_REPOSITORIES,
  configDualTheme,
  configRepositories,
  normalizeChartConfig,
  normalizeChartModel,
} from './config/defaults.js';
export type { ChartConfigInput, ChartModelInput } from './config/defaults.js';
export {
  LIGHT_PALETTE,
  DARK_PALETTE,
  basePalette,
  applyOverrides,
} from './config/themes.js';

export { normalizeHistory, HistoryError } from './history/normalize.js';
export { selectWindow } from './history/window.js';
export { bucketWindow } from './history/bucket.js';
export { buildChartModel } from './history/model.js';
export { buildMultiRepositoryChartModel } from './history/multi.js';
export {
  aggregateDisplayName,
  aggregateHistories,
  aggregateMetadata,
} from './history/aggregate.js';

export { renderChart, getRenderer, SIZE_LIMITS } from './renderers/index.js';
export type { Renderer, RenderOutput } from './renderers/index.js';
export {
  contribGeometry,
  columnHeight,
  tipClassFromTop,
  RenderError,
} from './renderers/contributions.js';
export type { ContribFrame } from './renderers/contributions.js';
export { buildFrameSequence, frameTheme } from './renderers/frames.js';
export type {
  ChartFrame,
  FrameSequence,
  FrameOptions,
} from './renderers/frames.js';
export { renderChartGif } from './renderers/gif.js';
export type { GifResult, GifOptions } from './renderers/gif.js';

export type { RawWeek } from './api/history.js';
export {
  deriveDualPaths,
  validateOutputPath,
  outputFormat,
  PathValidationError,
} from './utils/path.js';
export type { DualOutputPaths, OutputFormat } from './utils/path.js';
export { utcWeekStart } from './utils/dates.js';
export {
  INFINITE_GROWTH,
  OUTPUT_NAMES,
  buildOutputs,
  buildPictureSnippet,
  chartAltText,
  formatGrowthPercentage,
  outputEntries,
} from './outputs.js';
export type { BuildOutputsOptions, PictureSnippetOptions } from './outputs.js';
export { ApiError } from './api/errors.js';

import type {
  NormalizedHistory,
  RepositoryMetadata,
  RepositoryHistorySource,
} from './models/index.js';
import type { ChartConfigInput } from './config/defaults.js';
import { buildChartModel } from './history/model.js';
import { buildMultiRepositoryChartModel } from './history/multi.js';
import { renderChart } from './renderers/index.js';

/**
 * Convenience helper: builds the chart model from normalized history and
 * renders it to an SVG string. Omitted block dimensions fall back to
 * {@link DEFAULT_COLUMNS} / {@link DEFAULT_ROWS}.
 */
export function renderStarChart(
  config: ChartConfigInput,
  metadata: RepositoryMetadata,
  history: NormalizedHistory,
  asOf: number,
): string {
  const model = buildChartModel(config, metadata, history, { asOf });
  return renderChart(model).svg;
}

/** Render independent repository sources, preserving aligned comparison data. */
export function renderMultiRepositoryStarChart(
  config: ChartConfigInput,
  sources: readonly RepositoryHistorySource[],
  asOf: number,
): string {
  return renderChart(buildMultiRepositoryChartModel(config, sources, { asOf }))
    .svg;
}
