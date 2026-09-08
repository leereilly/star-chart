import type { ChartModel } from '../models/index.js';
export declare class RenderError extends Error {
    constructor(message: string);
}
/** CSS custom-property names used across renderers. */
export declare const CSS_VARS: {
    readonly empty: "--sc-empty";
    readonly l1: "--sc-l1";
    readonly l2: "--sc-l2";
    readonly l3: "--sc-l3";
    readonly l4: "--sc-l4";
    readonly text: "--sc-text";
    readonly muted: "--sc-muted";
    readonly border: "--sc-border";
    readonly accent: "--sc-accent";
    readonly stroke: "--sc-stroke";
    readonly fill: "--sc-fill";
    readonly axis: "--sc-axis";
};
/**
 * Base utility CSS. Colours are exposed as classes because CSS `var()` is only
 * valid in CSS properties, not SVG presentation attributes.
 */
export declare function baseCss(fontFamily: string): string;
/**
 * Ratio of the configured axis legend size to the default. Axis metrics
 * (reserved bands, gutters, label gaps) are multiplied by it so a larger
 * legend stays inside its region instead of colliding with the plot.
 */
export declare function axisScale(model: ChartModel): number;
/** Height of the band reserved below the plot for the date legend. */
export declare function datesHeight(model: ChartModel): number;
export declare function axisGutter(model: ChartModel): number;
export interface LegendEntry {
    readonly label: string;
    readonly className: string;
}
/** The aggregate is one series; only clustered bars compare repositories. */
export declare function legendEntries(model: ChartModel): LegendEntry[];
export declare function legendHeight(model: ChartModel): number;
/** Legend labels remain static and outside the plot's animation clips. */
export declare function renderLegend(model: ChartModel): string;
/** Layout regions and shared metrics for a rendered chart. */
export interface Layout {
    readonly width: number;
    readonly height: number;
    readonly padX: number;
    readonly padTop: number;
    readonly headerHeight: number;
    readonly plotTop: number;
    readonly plotHeight: number;
    readonly plotWidth: number;
    readonly datesHeight: number;
    readonly footerHeight: number;
}
/**
 * Builds the theme CSS: light defaults with a dark media override for `auto`,
 * or a single fixed theme otherwise. Custom palette overrides apply in both.
 */
export declare function buildThemeCss(model: ChartModel): string;
export declare function makeId(model: ChartModel): (name: string) => string;
/**
 * Resolves the concrete CSS custom-property values for one theme, applying any
 * palette overrides. Used to flatten `var(--sc-…)` references when rasterizing
 * to formats (such as GIF) whose renderers do not evaluate CSS variables.
 */
export declare function resolveThemeVars(model: ChartModel, theme: 'light' | 'dark'): Record<string, string>;
/**
 * Rewrites every `var(--sc-…)` reference in an SVG string to the concrete
 * colour for `theme`. Raster back-ends (resvg) ignore CSS custom properties,
 * so a themed frame must resolve them ahead of time. Unknown variables collapse
 * to `none` so a stray reference never paints an unintended colour.
 */
export declare function flattenThemeVars(svg: string, model: ChartModel, theme: 'light' | 'dark'): string;
export declare function chartTitle(model: ChartModel): string;
export declare function chartDescription(model: ChartModel): string;
export declare function hasHeader(model: ChartModel): boolean;
export declare function headerHeight(model: ChartModel): number;
/** Renders the subtle header row(s). */
export declare function renderHeader(model: ChartModel, layout: Layout): string;
/** Reveal the real total during the final tenth of the build, then hold. */
export declare function totalRevealCss(model: ChartModel): string;
/** Renders sparse, collision-checked date labels below the plot. */
export declare function renderDates(model: ChartModel, layout: Layout, xForColumn: (index: number) => number, timeForColumn?: (index: number) => number): string;
/** Small "Star Chart" wordmark, controlled by the `logo` config. */
export declare function renderLogo(model: ChartModel, layout: Layout): string;
/** Wraps document content in a complete, standalone SVG string. */
export declare function wrapDocument(params: {
    model: ChartModel;
    layout: Layout;
    style: string;
    defs?: string | undefined;
    body: string;
    titleId: string;
    descId: string;
}): string;
