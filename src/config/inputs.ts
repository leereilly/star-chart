import type {
  AnimationConfig,
  ChartConfig,
  ChartStyle,
  DateFormat,
  Palette,
  PeriodName,
  RepositoryRef,
  ScaleMode,
  ThemeName,
} from '../models/index.js';
import { validateOutputPath } from '../utils/path.js';
import {
  DEFAULT_AXIS_FONT_SIZE,
  DEFAULT_COLUMNS,
  DEFAULT_ROWS,
  MAX_REPOSITORIES,
} from './defaults.js';
import {
  ConfigError,
  parseBackground,
  parseBoolean,
  parseColor,
  parseEnum,
  parseFontFamily,
  parseInteger,
  parseOptionalInteger,
  parseRepositories,
  parseRepository,
  parseSeconds,
  parseTitle,
} from './validate.js';

/** Raw input map (string keyed) as delivered by the Action or programmatically. */
export type RawInputs = Record<string, string | undefined>;

export interface ParseOptions {
  /** Environment used for token/repository fallbacks. */
  readonly env?: NodeJS.ProcessEnv;
  /** Collects non-fatal warnings. */
  readonly warn?: (message: string) => void;
}

export interface ParsedConfig {
  readonly config: ChartConfig;
  /** Resolved token (may be empty for unauthenticated access). */
  readonly token: string;
}

const STYLES: readonly ChartStyle[] = [
  'contributions',
  'line',
  'area',
  'bar',
  'sparkline',
  'grid',
  'step-line',
  'milestone-scatter',
  'milestone-area',
  'clustered-bar',
  'neon-glow',
  'neon-glow-stream',
  'ascii-terminal',
  'hand-drawn',
];
const THEMES: readonly ThemeName[] = ['light', 'dark', 'auto'];

/** Theme used when none is supplied; also the fixed light half of dual mode. */
const DEFAULT_THEME: ThemeName = 'light';
const SCALES: readonly ScaleMode[] = ['absolute', 'visible'];
const DATE_FORMATS: readonly DateFormat[] = ['short', 'long', 'iso'];
const PERIODS: readonly PeriodName[] = ['3m', '6m', '1y', '2y', '5y', 'all'];

/** Period name -> API week count. `all` selects the entire history. */
export const PERIOD_WEEKS: Record<Exclude<PeriodName, 'all'>, number> = {
  '3m': 13,
  '6m': 26,
  '1y': 52,
  '2y': 104,
  '5y': 260,
};

const DEFAULT_FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';

const MAX_WEEKS = 3000;

/** Explicit background handling modes selectable via `background_mode`. */
const BACKGROUND_MODES = ['transparent', 'solid'] as const;

/**
 * Parses raw inputs into a fully validated {@link ChartConfig}.
 *
 * Pure: performs no network or filesystem access.
 */
export function parseInputs(
  raw: RawInputs,
  options: ParseOptions = {},
): ParsedConfig {
  const env = options.env ?? {};
  const warn = options.warn ?? ((): void => undefined);

  const token =
    firstNonEmpty(raw.token, env.GITHUB_TOKEN, env.INPUT_TOKEN) ?? '';

  const repositories = resolveRepositories(raw, env, warn);
  const repository = repositories[0] as RepositoryRef;

  const output = validateOutputPath(
    firstNonEmpty(raw.output) ?? 'assets/star-chart.svg',
  );

  const style = parseEnum('style', raw.style, STYLES, 'contributions');
  const dualTheme = parseBoolean('dual_theme', raw.dual_theme, false);
  const theme = resolveTheme(raw, dualTheme, warn);
  const scale = parseEnum('scale', raw.scale, SCALES, 'absolute');
  const dateFormat = parseEnum(
    'date_format',
    raw.date_format,
    DATE_FORMATS,
    'short',
  );

  const { weeks, period } = resolveWeeks(raw, warn);

  const columns = parseInteger('columns', raw.columns, DEFAULT_COLUMNS, 1, 260);
  const rows = parseInteger('rows', raw.rows, DEFAULT_ROWS, 1, 200);
  if (columns * rows > 52_000) {
    throw new ConfigError(
      `columns × rows must not exceed 52,000 (got ${columns * rows}).`,
    );
  }

  const width = parseInteger('width', raw.width, 900, 240, 2400);
  const height = parseOptionalInteger('height', raw.height, 120, 4800);

  const cellSize = parseOptionalInteger('cell_size', raw.cell_size, 1, 32);
  const cellGap = parseOptionalInteger('cell_gap', raw.cell_gap, 0, 12);
  const cellRadius = parseOptionalInteger(
    'cell_radius',
    raw.cell_radius,
    0,
    16,
  );
  if (
    cellRadius !== null &&
    cellSize !== null &&
    cellRadius > Math.floor(cellSize / 2)
  ) {
    throw new ConfigError('cell_radius must not exceed half of cell_size.');
  }

  const axisFontSize = parseInteger(
    'axis_font_size',
    raw.axis_font_size,
    DEFAULT_AXIS_FONT_SIZE,
    6,
    48,
  );

  const paletteOverrides = resolvePaletteOverrides(raw);
  const background = resolveBackground(raw, warn);
  const fontFamily = parseFontFamily(
    'font_family',
    raw.font_family,
    DEFAULT_FONT,
  );

  const animation = resolveAnimation(raw);

  const config: ChartConfig = {
    repository,
    repositories,
    output,
    style,
    theme,
    dualTheme,
    weeks,
    period,
    columns,
    rows,
    width,
    height,
    showTitle: parseBoolean('show_title', raw.show_title, true),
    showTotal: parseBoolean('show_total', raw.show_total, true),
    showChange: parseBoolean('show_change', raw.show_change, true),
    showDates: parseBoolean('show_dates', raw.show_dates, true),
    showXAxis: parseBoolean('show_x_axis', raw.show_x_axis, true),
    showYAxis: parseBoolean(
      'show_y_axis',
      raw.show_y_axis,
      style !== 'sparkline',
    ),
    showLegend: parseBoolean(
      'show_legend',
      raw.show_legend,
      style !== 'sparkline',
    ),
    title: parseTitle(raw.title),
    dateFormat,
    axisFontSize,
    cellSize,
    cellGap,
    cellRadius,
    background,
    paletteOverrides,
    fontFamily,
    scale,
    logo: parseBoolean('logo', raw.logo, true),
    animation,
  };

  return { config, token };
}

/**
 * Resolves the repositories to chart.
 *
 * A non-blank `repositories` list takes precedence over `repository`. An
 * explicit, meaningfully different `repository` alongside it is a likely
 * mistake, so it warns rather than silently discarding the value. A blank
 * list preserves the historical single-repository behaviour exactly.
 */
function resolveRepositories(
  raw: RawInputs,
  env: NodeJS.ProcessEnv,
  warn: (message: string) => void,
): readonly RepositoryRef[] {
  const list = parseRepositories(raw.repositories, {
    max: MAX_REPOSITORIES,
    warn,
  });

  if (list.length === 0) {
    return [
      parseRepository(firstNonEmpty(raw.repository, env.GITHUB_REPOSITORY)),
    ];
  }

  const explicit = firstNonEmpty(raw.repository);
  const inherited = firstNonEmpty(env.GITHUB_REPOSITORY);
  const isWorkflowDefault =
    explicit !== undefined &&
    inherited !== undefined &&
    explicit.trim().toLowerCase() === inherited.trim().toLowerCase();
  const alreadyListed =
    explicit !== undefined &&
    list.some(
      (entry) =>
        `${entry.owner}/${entry.repo}`.toLowerCase() ===
        explicit.trim().toLowerCase(),
    );

  if (explicit !== undefined && !isWorkflowDefault && !alreadyListed) {
    warn(
      `Both "repositories" and "repository" were supplied; "repositories" ` +
        `takes precedence and "${explicit.trim()}" is not charted.`,
    );
  }

  return list;
}

/**
 * Resolves the theme. Dual mode always renders one fixed light and one fixed
 * dark file, so an explicit `theme` is ignored; the returned value is only
 * used in single mode.
 *
 * The warning is deliberately conditional: the Action always supplies the
 * `light` default, so warning on any non-empty value would fire on every dual
 * run. Only a value that would actually have changed the output is reported.
 */
function resolveTheme(
  raw: RawInputs,
  dualTheme: boolean,
  warn: (message: string) => void,
): ThemeName {
  const theme = parseEnum('theme', raw.theme, THEMES, DEFAULT_THEME);
  if (
    dualTheme &&
    firstNonEmpty(raw.theme) !== undefined &&
    theme !== DEFAULT_THEME
  ) {
    warn(
      `"dual_theme" renders fixed light and dark files; the "theme" input ` +
        `("${theme}") is ignored.`,
    );
  }
  return theme;
}

function resolveWeeks(
  raw: RawInputs,
  warn: (message: string) => void,
): { weeks: number; period: PeriodName | null } {
  const rawPeriod = firstNonEmpty(raw.period);
  const rawWeeks = firstNonEmpty(raw.weeks);

  if (rawPeriod !== undefined) {
    const period = parseEnum('period', rawPeriod, PERIODS, '1y');
    if (rawWeeks !== undefined) {
      warn(
        'Both "period" and "weeks" were supplied; "period" takes precedence.',
      );
    }
    if (period === 'all') {
      return { weeks: MAX_WEEKS, period };
    }
    return { weeks: PERIOD_WEEKS[period], period };
  }

  if (rawWeeks !== undefined) {
    const weeks = parseInteger('weeks', rawWeeks, 52, 1, MAX_WEEKS);
    return { weeks, period: null };
  }

  return { weeks: PERIOD_WEEKS['1y'], period: '1y' };
}

/**
 * Resolves the renderer-ready background string, honouring an explicit
 * `background_mode` while preserving the legacy magic-value inference when the
 * mode is blank.
 *
 * - Blank mode: `transparent`/`none`/empty -> `transparent`; hex -> solid.
 * - `transparent`: always `transparent`; a supplied colour is ignored (warns).
 * - `solid`: requires a valid hex `background`; transparent/none/empty and CSS
 *   names throw {@link ConfigError}.
 */
function resolveBackground(
  raw: RawInputs,
  warn: (message: string) => void,
): string {
  const rawMode = firstNonEmpty(raw.background_mode);
  if (rawMode === undefined) {
    return parseBackground('background', raw.background);
  }

  const mode = parseEnum(
    'background_mode',
    rawMode,
    BACKGROUND_MODES,
    'transparent',
  );

  const rawBackground = firstNonEmpty(raw.background);

  if (mode === 'transparent') {
    if (rawBackground !== undefined && !isTransparentKeyword(rawBackground)) {
      warn(
        `background_mode "transparent" ignores the supplied "background" value ("${rawBackground}").`,
      );
    }
    return 'transparent';
  }

  // mode === 'solid'
  if (rawBackground === undefined || isTransparentKeyword(rawBackground)) {
    throw new ConfigError(
      `background_mode "solid" requires a hex "background" colour (got "${rawBackground ?? ''}").`,
    );
  }
  return parseColor('background', rawBackground);
}

function isTransparentKeyword(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return value === 'transparent' || value === 'none';
}

function resolvePaletteOverrides(raw: RawInputs): Partial<Palette> {
  const overrides: { -readonly [K in keyof Palette]?: string } = {};
  const map: Array<[keyof Palette, string]> = [
    ['empty', 'empty_color'],
    ['level1', 'level_1_color'],
    ['level2', 'level_2_color'],
    ['level3', 'level_3_color'],
    ['level4', 'level_4_color'],
  ];
  for (const [key, input] of map) {
    const value = firstNonEmpty(raw[input]);
    if (value !== undefined) {
      overrides[key] = parseColor(input, value);
    }
  }
  return overrides;
}

function resolveAnimation(raw: RawInputs): AnimationConfig {
  const mode = parseEnum(
    'animation',
    raw.animation,
    ['none', 'once', 'loop'] as const,
    'none',
  );
  return {
    mode,
    durationSeconds: parseSeconds(
      'animation_duration',
      raw.animation_duration,
      4,
      0.2,
      60,
    ),
    pauseSeconds: parseSeconds(
      'animation_pause',
      raw.animation_pause,
      2,
      0,
      60,
    ),
    delaySeconds: parseSeconds(
      'animation_delay',
      raw.animation_delay,
      0,
      0,
      60,
    ),
    style: parseEnum(
      'animation_style',
      raw.animation_style,
      ['grow', 'reveal', 'cascade'] as const,
      'grow',
    ),
    direction: parseEnum(
      'animation_direction',
      raw.animation_direction,
      ['chronological', 'simultaneous'] as const,
      'chronological',
    ),
    easing: parseEnum(
      'animation_easing',
      raw.animation_easing,
      ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const,
      'ease-out',
    ),
    animateTotal: parseBoolean('animate_total', raw.animate_total, false),
  };
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
}
