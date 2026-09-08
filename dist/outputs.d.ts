/**
 * Derivation of the Action's rich outputs from a built chart model.
 *
 * Pure: no filesystem or network access. The caller writes every file first
 * and only then turns these values into Action outputs.
 */
import type { ChartModel, ChartOutputs } from './models/index.js';
/** Growth shown when the baseline is zero but stars were still added. */
export declare const INFINITE_GROWTH = "\u221E";
/**
 * Formats window growth relative to the pre-window baseline.
 *
 * - baseline > 0: `added / baseline * 100`, fixed to two decimals, `%`-suffixed
 * - baseline 0 and nothing added: `0.00%` (no growth from nothing)
 * - baseline 0 and additions: {@link INFINITE_GROWTH} (undefined ratio)
 */
export declare function formatGrowthPercentage(baseline: number, added: number): string;
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
export declare function buildPictureSnippet(options: PictureSnippetOptions): string;
/**
 * Default alt text for the picture snippet: the configured title when set,
 * otherwise the (possibly aggregate) repository display name.
 */
export declare function chartAltText(model: ChartModel): string;
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
export declare function buildOutputs(model: ChartModel, options: BuildOutputsOptions): ChartOutputs;
/** The Action output names, in declaration order. */
export declare const OUTPUT_NAMES: readonly ["chart_path", "chart_path_light", "chart_path_dark", "stars", "stars_added", "growth_percentage", "peak_gain", "period_start", "period_end", "picture_snippet"];
/** Maps {@link ChartOutputs} onto the string-valued Action output names. */
export declare function outputEntries(outputs: ChartOutputs): Array<[(typeof OUTPUT_NAMES)[number], string]>;
