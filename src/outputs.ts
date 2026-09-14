/**
 * Derivation of the Action's rich outputs from a built chart model.
 *
 * Pure: no filesystem or network access. The caller writes every file first
 * and only then turns these values into Action outputs.
 */

import type { ChartModel, ChartOutputs } from './models/index.js';
import { escapeAttr, stripControls } from './utils/svg.js';

/** Growth shown when the baseline is zero but stars were still added. */
export const INFINITE_GROWTH = '∞';

/**
 * Formats window growth relative to the pre-window baseline.
 *
 * - baseline > 0: `added / baseline * 100`, fixed to two decimals, `%`-suffixed
 * - baseline 0 and nothing added: `0.00%` (no growth from nothing)
 * - baseline 0 and additions: {@link INFINITE_GROWTH} (undefined ratio)
 */
export function formatGrowthPercentage(
  baseline: number,
  added: number,
): string {
  if (baseline > 0) {
    return `${((added / baseline) * 100).toFixed(2)}%`;
  }
  return added > 0 ? INFINITE_GROWTH : '0.00%';
}

export interface PictureSnippetOptions {
  /** Workspace-relative path of the light-theme SVG (the fallback). */
  readonly lightPath: string;
  /** Workspace-relative path of the dark-theme SVG (the media source). */
  readonly darkPath: string;
  /** Accessible description for the fallback image. */
  readonly alt: string;
  /** Optional display width in px. */
  readonly width?: number | undefined;
}

/**
 * Builds copy-paste `<picture>` markup for a dual-theme pair: a
 * `prefers-color-scheme: dark` source with the light file as the universal
 * `<img>` fallback. Paths stay workspace-relative so the snippet works from a
 * README in the same repository; every value is attribute-escaped.
 */
export function buildPictureSnippet(options: PictureSnippetOptions): string {
  const width =
    typeof options.width === 'number' && Number.isFinite(options.width)
      ? ` width="${Math.round(options.width)}"`
      : '';
  return [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${escapeAttr(options.darkPath)}">`,
    `  <img alt="${escapeAttr(options.alt)}" src="${escapeAttr(options.lightPath)}"${width}>`,
    '</picture>',
  ].join('\n');
}

/**
 * Default alt text for the picture snippet: the configured title when set,
 * otherwise the (possibly aggregate) repository display name.
 */
export function chartAltText(model: ChartModel): string {
  const subject = model.config.title ?? model.metadata.fullName;
  // Attribute escaping happens at snippet construction; only strip what can
  // never appear in markup.
  return stripControls(`Star history for ${subject}`);
}

export interface BuildOutputsOptions {
  /** The primary written path (the light file in dual mode). */
  readonly chartPath: string;
  /** Light path in dual mode; empty in single mode. */
  readonly chartPathLight?: string;
  /** Dark path in dual mode; empty in single mode. */
  readonly chartPathDark?: string;
}

/**
 * Assembles the full output set. Light/dark paths and the picture snippet are
 * only populated for a dual-theme run; single-theme runs report empty strings
 * so consumers can branch on emptiness.
 */
export function buildOutputs(
  model: ChartModel,
  options: BuildOutputsOptions,
): ChartOutputs {
  const light = options.chartPathLight ?? '';
  const dark = options.chartPathDark ?? '';
  const dual = light !== '' && dark !== '';

  return {
    chartPath: options.chartPath,
    chartPathLight: light,
    chartPathDark: dark,
    stars: model.currentStars,
    starsAdded: model.windowAdded,
    growthPercentage: formatGrowthPercentage(model.baseline, model.windowAdded),
    peakGain: model.peakGain,
    periodStart: model.periodStart,
    periodEnd: model.periodEnd,
    pictureSnippet: dual
      ? buildPictureSnippet({
          lightPath: light,
          darkPath: dark,
          alt: chartAltText(model),
          width: model.config.width,
        })
      : '',
  };
}

/** The Action output names, in declaration order. */
export const OUTPUT_NAMES = [
  'chart_path',
  'chart_path_light',
  'chart_path_dark',
  'stars',
  'stars_added',
  'growth_percentage',
  'peak_gain',
  'period_start',
  'period_end',
  'picture_snippet',
] as const;

/** Maps {@link ChartOutputs} onto the string-valued Action output names. */
export function outputEntries(
  outputs: ChartOutputs,
): Array<[(typeof OUTPUT_NAMES)[number], string]> {
  return [
    ['chart_path', outputs.chartPath],
    ['chart_path_light', outputs.chartPathLight],
    ['chart_path_dark', outputs.chartPathDark],
    ['stars', String(outputs.stars)],
    ['stars_added', String(outputs.starsAdded)],
    ['growth_percentage', outputs.growthPercentage],
    ['peak_gain', String(outputs.peakGain)],
    ['period_start', outputs.periodStart],
    ['period_end', outputs.periodEnd],
    ['picture_snippet', outputs.pictureSnippet],
  ];
}
