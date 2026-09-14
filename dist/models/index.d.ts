/**
 * Shared domain models for Star Chart.
 *
 * The pipeline flows: raw inputs -> ChartConfig -> normalized history ->
 * selected window -> buckets -> ChartModel -> renderer -> SVG string.
 */
export type ChartStyle = 'contributions' | 'line' | 'area' | 'bar' | 'sparkline' | 'grid' | 'step-line' | 'milestone-scatter' | 'milestone-area' | 'clustered-bar' | 'neon-glow' | 'neon-glow-stream' | 'ascii-terminal' | 'hand-drawn';
export type ThemeName = 'light' | 'dark' | 'auto';
export type ScaleMode = 'absolute' | 'visible';
export type DateFormat = 'short' | 'long' | 'iso';
export type PeriodName = '3m' | '6m' | '1y' | '2y' | '5y' | 'all';
export type AnimationMode = 'none' | 'once' | 'loop';
export type AnimationStyle = 'grow' | 'reveal' | 'cascade';
export type AnimationDirection = 'chronological' | 'simultaneous';
export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
/** A resolved colour palette for a single theme. */
export interface Palette {
    readonly empty: string;
    readonly level1: string;
    readonly level2: string;
    readonly level3: string;
    readonly level4: string;
}
export interface AnimationConfig {
    readonly mode: AnimationMode;
    readonly durationSeconds: number;
    readonly pauseSeconds: number;
    readonly delaySeconds: number;
    readonly style: AnimationStyle;
    readonly direction: AnimationDirection;
    readonly easing: EasingName;
    readonly animateTotal: boolean;
}
/**
 * Fully validated, renderer-ready configuration. Contains no raw strings that
 * still require interpretation.
 */
export interface ChartConfig {
    readonly repository: RepositoryRef;
    /**
     * Every repository aggregated into the chart, in resolved order. Optional
     * for backward compatibility: omitted or empty means `[repository]`.
     * Use `configRepositories` to read it safely.
     */
    readonly repositories?: readonly RepositoryRef[];
    readonly output: string;
    readonly style: ChartStyle;
    readonly theme: ThemeName;
    /**
     * True when a fixed light and a fixed dark file should both be produced.
     * Optional for backward compatibility: omitted means `false`, and `theme`
     * is ignored when it is true.
     */
    readonly dualTheme?: boolean;
    /** Number of trailing API weeks to select (already resolved from period). */
    readonly weeks: number;
    /** Which period name, if any, drove the week count (for labelling). */
    readonly period: PeriodName | null;
    /** Horizontal display buckets. */
    readonly columns: number;
    /** Vertical levels for tiled and terminal charts. */
    readonly rows: number;
    readonly width: number;
    /** Explicit pixel height, or null for automatic geometry. */
    readonly height: number | null;
    readonly showTitle: boolean;
    readonly showTotal: boolean;
    readonly showChange: boolean;
    readonly showDates: boolean;
    readonly showXAxis: boolean;
    readonly showYAxis: boolean;
    readonly showLegend: boolean;
    /** Explicit title override, or null to derive from the repository. */
    readonly title: string | null;
    readonly dateFormat: DateFormat;
    /**
     * Font size in px for dates, numeric ticks and chart legends.
     * Reserved label space scales with it.
     */
    readonly axisFontSize: number;
    /** Explicit cell edge in px, or null for automatic sizing. */
    readonly cellSize: number | null;
    readonly cellGap: number | null;
    readonly cellRadius: number | null;
    readonly background: string;
    /** Palette overrides applied on top of theme defaults. */
    readonly paletteOverrides: Partial<Palette>;
    readonly fontFamily: string;
    readonly scale: ScaleMode;
    readonly logo: boolean;
    readonly animation: AnimationConfig;
}
export interface RepositoryRef {
    readonly owner: string;
    readonly repo: string;
}
/** Repository metadata fetched once from the REST API. */
export interface RepositoryMetadata {
    readonly owner: string;
    readonly repo: string;
    /** Canonical `owner/repo`. */
    readonly fullName: string;
    /** ISO timestamp of repository creation. */
    readonly createdAt: string;
    /** Current stargazer count reported by the API. */
    readonly stargazersCount: number;
}
/** A single normalized weekly observation. */
export interface WeekPoint {
    /** UTC-preserved ISO timestamp of the week bucket start. */
    readonly timestamp: string;
    /** Epoch milliseconds parsed from {@link timestamp}. */
    readonly time: number;
    /** Stars added during this week (non-cumulative). */
    readonly added: number;
    /** True when this slot was synthesised to fill an internal gap. */
    readonly synthetic: boolean;
}
/** Fully normalized history plus derived cumulative sums. */
export interface NormalizedHistory {
    readonly weeks: readonly WeekPoint[];
    /** Cumulative additions aligned to {@link weeks} (running total). */
    readonly cumulative: readonly number[];
    /** True when any internal weekly slot was synthesised. */
    readonly hasSyntheticWeeks: boolean;
    /** Total recorded additions across the entire available history. */
    readonly totalAdded: number;
}
/** One independently fetched repository, before aggregation. */
export interface RepositoryHistorySource {
    readonly metadata: RepositoryMetadata;
    readonly history: NormalizedHistory;
}
/** Repository data aligned to the aggregate's exact display intervals. */
export interface RepositorySeries {
    readonly metadata: RepositoryMetadata;
    readonly buckets: readonly Bucket[];
    readonly selectedWeeks: readonly WeekPoint[];
    readonly baseline: number;
    readonly windowMax: number;
    readonly hasSyntheticWeeks: boolean;
}
/** One aggregated display column. */
export interface Bucket {
    /** Display interval start within the nominal API weeks (epoch ms). */
    readonly startTime: number;
    /** Display interval end; the final API week may still be partial. */
    readonly endTime: number;
    /** Whole weekly observations included; zero denotes a carry-forward slot. */
    readonly observations: number;
    /** Additions summed within the bucket. */
    readonly added: number;
    /** Cumulative additions as of the end of the bucket. */
    readonly cumulative: number;
}
/** The selected window plus its aggregation into display buckets. */
export interface WindowSelection {
    readonly weeks: readonly WeekPoint[];
    readonly cumulative: readonly number[];
    /** Cumulative additions immediately before the window (the baseline). */
    readonly baseline: number;
    /** Sum of additions inside the selected window. */
    readonly windowAdded: number;
    /** True when coverage gaps required synthetic weeks anywhere in history. */
    readonly hasSyntheticWeeks: boolean;
}
/** Immutable model consumed by every renderer. */
export interface ChartModel {
    readonly config: ChartConfig;
    readonly metadata: RepositoryMetadata;
    readonly buckets: readonly Bucket[];
    /** Optional comparison data; ordinary styles still render the aggregate. */
    readonly series?: readonly RepositorySeries[];
    /**
     * The selected source weeks backing {@link buckets}. Display buckets may
     * merge or split these; statistics that must describe real observations
     * (such as {@link peakGain}) read this series instead.
     */
    readonly selectedWeeks: readonly WeekPoint[];
    /** Cumulative additions before the selected window. */
    readonly baseline: number;
    /** Maximum cumulative value within the window (for scaling). */
    readonly windowMax: number;
    /** Sum of additions inside the selected window. */
    readonly windowAdded: number;
    /**
     * Largest additions recorded in a single selected **source** week. Never a
     * display-bucket total, which can merge several weeks.
     */
    readonly peakGain: number;
    /** Current stars from metadata (may differ from cumulative additions). */
    readonly currentStars: number;
    /** ISO UTC display date for the window start. */
    readonly periodStart: string;
    /** ISO UTC display date for the window end. */
    readonly periodEnd: string;
    /** Human label for the selected period (e.g. "1 year"). */
    readonly periodLabel: string;
    /** True when synthetic weeks were inserted (coverage warning). */
    readonly hasSyntheticWeeks: boolean;
    /** True when there are no recorded additions at all. */
    readonly isEmpty: boolean;
}
/** Values surfaced as GitHub Action outputs. */
export interface ChartOutputs {
    readonly chartPath: string;
    /** Light-theme path in dual mode; empty string in single mode. */
    readonly chartPathLight: string;
    /** Dark-theme path in dual mode; empty string in single mode. */
    readonly chartPathDark: string;
    readonly stars: number;
    readonly starsAdded: number;
    /**
     * Window growth relative to the baseline, formatted to two decimals with a
     * trailing `%`, or `∞` when the baseline is zero and stars were added.
     */
    readonly growthPercentage: string;
    /** Largest single selected source-week addition. */
    readonly peakGain: number;
    readonly periodStart: string;
    readonly periodEnd: string;
    /** Ready-to-paste `<picture>` markup in dual mode; empty in single mode. */
    readonly pictureSnippet: string;
}
