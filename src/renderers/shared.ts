import type { ChartModel } from '../models/index.js';
import {
  applyOverrides,
  basePalette,
  DARK_COLORS,
  LIGHT_COLORS,
  type ThemeColors,
} from '../config/themes.js';
import {
  configRepositories,
  DEFAULT_AXIS_FONT_SIZE,
} from '../config/defaults.js';
import { escapeText, escapeAttr, idFactory } from '../utils/svg.js';
import { formatDate } from '../utils/dates.js';
import { compactNumber, withCommas } from '../utils/numbers.js';
import { resolveTimeline, progressKeyframes } from './animation.js';
import { freezeProgress, totalRevealOpacityAt } from './freeze.js';

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
  }
}

/** CSS custom-property names used across renderers. */
export const CSS_VARS = {
  empty: '--sc-empty',
  l1: '--sc-l1',
  l2: '--sc-l2',
  l3: '--sc-l3',
  l4: '--sc-l4',
  text: '--sc-text',
  muted: '--sc-muted',
  border: '--sc-border',
  accent: '--sc-accent',
  stroke: '--sc-stroke',
  fill: '--sc-fill',
  axis: '--sc-axis',
} as const;

/**
 * Base utility CSS. Colours are exposed as classes because CSS `var()` is only
 * valid in CSS properties, not SVG presentation attributes.
 */
export function baseCss(fontFamily: string): string {
  return [
    `.sc-root{font-family:${fontFamily};}`,
    `.sc-t{fill:var(${CSS_VARS.text});}`,
    `.sc-m{fill:var(${CSS_VARS.muted});}`,
    `.sc-a{fill:var(${CSS_VARS.accent});}`,
    `.sc-empty{fill:var(${CSS_VARS.empty});}`,
    `.sc-l1{fill:var(${CSS_VARS.l1});}`,
    `.sc-l2{fill:var(${CSS_VARS.l2});}`,
    `.sc-l3{fill:var(${CSS_VARS.l3});}`,
    `.sc-l4{fill:var(${CSS_VARS.l4});}`,
    `.sc-stroke{fill:none;stroke:var(${CSS_VARS.stroke});}`,
    `.sc-area{fill:var(${CSS_VARS.fill});}`,
    `.sc-bar{fill:var(${CSS_VARS.stroke});}`,
    `.sc-axis{stroke:var(${CSS_VARS.axis});}`,
    `.sc-dot{fill:var(${CSS_VARS.stroke});}`,
  ].join('');
}

/**
 * Ratio of the configured axis legend size to the default. Axis metrics
 * (reserved bands, gutters, label gaps) are multiplied by it so a larger
 * legend stays inside its region instead of colliding with the plot.
 */
export function axisScale(model: ChartModel): number {
  return model.config.axisFontSize / DEFAULT_AXIS_FONT_SIZE;
}

/** Height of the band reserved below the plot for the date legend. */
export function datesHeight(model: ChartModel): number {
  return model.config.showXAxis && model.config.showDates
    ? Math.round(24 * axisScale(model))
    : 8;
}

export function axisGutter(model: ChartModel): number {
  return model.config.showYAxis ? Math.round(40 * axisScale(model)) : 0;
}

export interface LegendEntry {
  readonly label: string;
  readonly className: string;
}

/** The aggregate is one series; only clustered bars compare repositories. */
export function legendEntries(model: ChartModel): LegendEntry[] {
  const name =
    configRepositories(model.config).length > 1
      ? 'Combined recorded stars'
      : 'Recorded stars';
  const style = model.config.style;
  if (style === 'clustered-bar') {
    const id = makeId(model);
    return (
      model.series?.length
        ? model.series.map((s) => s.metadata)
        : [model.metadata]
    ).map((metadata, i) => ({
      label: metadata.fullName,
      className: id(`series-${i}`),
    }));
  }
  if (style === 'contributions')
    return [
      { label: name, className: 'sc-l4' },
      { label: 'Column tip', className: 'sc-l4' },
      { label: '1 below tip', className: 'sc-l3' },
      { label: '2 below tip', className: 'sc-l2' },
      { label: 'Below tip (3+)', className: 'sc-l1' },
      { label: 'Unoccupied', className: 'sc-empty' },
    ];
  if (style === 'grid') {
    const min = model.config.scale === 'visible' ? model.baseline : 0;
    const max = Math.max(min + 1, model.windowMax);
    const boundary = (i: number): string => String(min + ((max - min) * i) / 4);
    return [
      { label: name, className: 'sc-l4' },
      ...Array.from({ length: 4 }, (_, i) => ({
        label: `(${boundary(i)}, ${boundary(i + 1)}]`,
        className: `sc-l${i + 1}`,
      })),
      { label: 'Unoccupied', className: 'sc-empty' },
    ];
  }
  return [
    {
      label: name,
      className: ['line', 'area', 'sparkline'].includes(style)
        ? 'sc-stroke'
        : style === 'bar'
          ? 'sc-bar'
          : 'sc-l4',
    },
  ];
}

interface LegendPlacement extends LegendEntry {
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly textWidth: number;
}

function legendLayout(model: ChartModel): {
  height: number;
  entries: LegendPlacement[];
} {
  if (!model.config.showLegend) return { height: 0, entries: [] };
  const size = model.config.axisFontSize;
  const available = model.config.width - 32;
  const swatch = size;
  const gap = size * 0.6;
  const rowHeight = size * 1.8;
  let x = 0;
  let row = 0;
  const entries = legendEntries(model).map((entry) => {
    const maxChars = Math.max(
      1,
      Math.floor((available - swatch - gap) / (size * 0.62)),
    );
    const chars = Array.from(entry.label);
    const label =
      chars.length > maxChars
        ? chars.slice(0, maxChars - 1).join('') + '…'
        : entry.label;
    const textWidth = Array.from(label).length * size * 0.62;
    const width = swatch + gap + textWidth;
    if (x > 0 && x + width > available) {
      row += 1;
      x = 0;
    }
    const placed = {
      ...entry,
      label,
      title: entry.label,
      x: 16 + x,
      y: row * rowHeight,
      textWidth,
    };
    x += width + size * 1.6;
    return placed;
  });
  return { height: (row + 1) * rowHeight + size * 0.8, entries };
}

export function legendHeight(model: ChartModel): number {
  return legendLayout(model).height;
}

/** Legend labels remain static and outside the plot's animation clips. */
export function renderLegend(model: ChartModel): string {
  const { entries } = legendLayout(model);
  if (!entries.length) return '';
  const size = model.config.axisFontSize;
  const top = 12 + headerHeight(model) + size;
  return `<g class="sc-legend">${entries
    .map(
      (entry) =>
        `<g><title>${escapeText(entry.title)}</title>` +
        (entry.className === 'sc-stroke'
          ? `<line class="sc-stroke" x1="${entry.x}" x2="${entry.x + size}" y1="${top + entry.y - size * 0.3}" y2="${top + entry.y - size * 0.3}" stroke-width="2"/>`
          : `<rect class="${entry.className}" x="${entry.x}" y="${top + entry.y - size * 0.8}" width="${size}" height="${size}"/>`) +
        `<text class="sc-m" x="${entry.x + size * 1.6}" y="${top + entry.y}" font-size="${size}" textLength="${entry.textWidth}" lengthAdjust="spacingAndGlyphs">${escapeText(entry.label)}</text></g>`,
    )
    .join('')}</g>`;
}

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

function themeVarValues(
  theme: 'light' | 'dark',
  model: ChartModel,
): Record<string, string> {
  const palette = applyOverrides(
    basePalette(theme),
    model.config.paletteOverrides,
  );
  const colors: ThemeColors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  return {
    [CSS_VARS.empty]: palette.empty,
    [CSS_VARS.l1]: palette.level1,
    [CSS_VARS.l2]: palette.level2,
    [CSS_VARS.l3]: palette.level3,
    [CSS_VARS.l4]: palette.level4,
    [CSS_VARS.text]: colors.text,
    [CSS_VARS.muted]: colors.muted,
    [CSS_VARS.border]: colors.border,
    [CSS_VARS.accent]: colors.accent,
    [CSS_VARS.stroke]: colors.stroke,
    [CSS_VARS.fill]: colors.fill,
    [CSS_VARS.axis]: colors.axis,
  };
}

function varsBlock(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}:${value};`)
    .join('');
}

/**
 * Builds the theme CSS: light defaults with a dark media override for `auto`,
 * or a single fixed theme otherwise. Custom palette overrides apply in both.
 */
export function buildThemeCss(model: ChartModel): string {
  const theme = model.config.theme;
  if (theme === 'light' || theme === 'dark') {
    return `:root{${varsBlock(themeVarValues(theme, model))}}`;
  }
  const light = themeVarValues('light', model);
  const dark = themeVarValues('dark', model);
  return (
    `:root{${varsBlock(light)}}` +
    `@media (prefers-color-scheme:dark){:root{${varsBlock(dark)}}}`
  );
}

export function makeId(model: ChartModel): (name: string) => string {
  return idFactory(`sc-${model.config.style}`);
}

/**
 * Resolves the concrete CSS custom-property values for one theme, applying any
 * palette overrides. Used to flatten `var(--sc-…)` references when rasterizing
 * to formats (such as GIF) whose renderers do not evaluate CSS variables.
 */
export function resolveThemeVars(
  model: ChartModel,
  theme: 'light' | 'dark',
): Record<string, string> {
  return themeVarValues(theme, model);
}

/**
 * Rewrites every `var(--sc-…)` reference in an SVG string to the concrete
 * colour for `theme`. Raster back-ends (resvg) ignore CSS custom properties,
 * so a themed frame must resolve them ahead of time. Unknown variables collapse
 * to `none` so a stray reference never paints an unintended colour.
 */
export function flattenThemeVars(
  svg: string,
  model: ChartModel,
  theme: 'light' | 'dark',
): string {
  const values = themeVarValues(theme, model);
  return svg.replace(
    /var\((--sc-[a-z0-9]+)\)/g,
    (_match, name: string) => values[name] ?? 'none',
  );
}

export function chartTitle(model: ChartModel): string {
  return model.config.title ?? model.metadata.fullName;
}

export function chartDescription(model: ChartModel): string {
  const parts: string[] = [];
  parts.push(
    `Star history for ${model.metadata.fullName} over ${model.periodLabel}.`,
  );
  parts.push(`${withCommas(model.currentStars)} current stars.`);
  parts.push(`${withCommas(model.windowAdded)} recorded additions in range.`);
  parts.push(
    `${model.periodStart} to ${model.periodEnd}. Scale: ${model.config.scale}.`,
  );
  parts.push(
    'Display intervals subdivide nominal API weeks; the final week may still be partial.',
  );
  if (model.config.style === 'contributions') {
    parts.push(
      'Column height approximates cumulative recorded stars in whole tiles; shading marks distance below each column tip, not value ranges.',
    );
  }
  if (model.config.style === 'grid') {
    parts.push(
      'Column height rounds up to whole tiles. Legend ranges exclude the lower bound and include the upper bound; unoccupied tiles are above the column height.',
    );
  }
  if (model.hasSyntheticWeeks) {
    parts.push('Some weeks had no recorded data and were treated as zero.');
  }
  if (model.isEmpty) {
    parts.push('No recorded additions in the available history.');
  }
  return parts.join(' ');
}

export function hasHeader(model: ChartModel): boolean {
  const c = model.config;
  return c.showTitle || c.showTotal || c.showChange;
}

interface HeaderText {
  readonly text: string;
  readonly width: number;
  readonly y: number;
  readonly className: string;
  readonly size: number;
  readonly right: boolean;
}

/**
 * Explicit text lengths make the reserved regions independent of installed
 * fonts. Long titles are ellipsized visually; the SVG title stays complete.
 */
function headerLines(model: ChartModel): HeaderText[] {
  const cfg = model.config;
  const available = cfg.width - 32;
  const lines: HeaderText[] = [];
  const length = (text: string, size: number): number =>
    Math.min(available, Array.from(text).length * size * 0.62);
  const total = cfg.showTotal ? `★ ${withCommas(model.currentStars)}` : '';
  const change =
    cfg.showChange && !model.isEmpty
      ? `+${compactNumber(model.windowAdded)}`
      : '';
  const totalWidth = length(total, 13);
  const changeWidth = length(change, 13);
  const statsWidth = totalWidth + changeWidth + (total && change ? 10 : 0);
  let statsY = 26;
  if (cfg.showTitle) {
    const fullTitle = Array.from(chartTitle(model));
    const maxChars = Math.floor(available / (14 * 0.62));
    const title =
      fullTitle.length > maxChars
        ? `${fullTitle.slice(0, maxChars - 1).join('')}…`
        : fullTitle.join('');
    const titleWidth = length(title, 14);
    lines.push({
      text: title,
      width: titleWidth,
      y: 26,
      className: 'sc-t sc-title',
      size: 14,
      right: false,
    });
    lines.push({
      text: model.periodLabel,
      width: length(model.periodLabel, 11),
      y: 42,
      className: 'sc-m',
      size: 11,
      right: false,
    });
    if (statsWidth + titleWidth + 16 > available) statsY = 64;
  }
  if (total) {
    lines.push({
      text: total,
      width: totalWidth,
      y: statsY,
      className: 'sc-t sc-total',
      size: 13,
      right: true,
    });
  }
  if (change) {
    const separate = statsWidth > available;
    lines.push({
      text: change,
      width: changeWidth,
      y: statsY + (separate && total ? 20 : 0),
      className: 'sc-m sc-change',
      size: 13,
      right: true,
    });
  }
  return lines;
}

export function headerHeight(model: ChartModel): number {
  return Math.max(8, ...headerLines(model).map((line) => line.y + 10 - 12));
}

/** Renders the subtle header row(s). */
export function renderHeader(model: ChartModel, layout: Layout): string {
  const lines = headerLines(model);
  if (lines.length === 0) return '';
  const change = lines.find((line) => line.className.includes('sc-change'));
  return `<g class="sc-header">${lines
    .map((line) => {
      const isTotal = line.className.includes('sc-total');
      const shift = isTotal && change?.y === line.y ? change.width + 10 : 0;
      const x = line.right ? layout.width - layout.padX - shift : layout.padX;
      const revealEligible =
        isTotal &&
        model.config.animation.animateTotal &&
        model.config.animation.mode !== 'none';
      const frozen = freezeProgress();
      // A frozen render bakes the reveal's current opacity as an attribute
      // (resvg cannot run the fade keyframes); the live SVG keeps the class the
      // `totalRevealCss` keyframes target.
      const reveal =
        revealEligible && frozen === null ? ` ${makeId(model)('total')}` : '';
      const frozenOpacity =
        revealEligible && frozen !== null
          ? ` opacity="${totalRevealOpacityAt(resolveTimeline(model.config.animation), frozen).toFixed(3)}"`
          : '';
      const text = isTotal
        ? `<tspan class="sc-a">★</tspan>${escapeText(line.text.slice(1))}`
        : escapeText(line.text);
      return (
        `<text x="${x}" y="${line.y}" class="${line.className}${reveal}" ` +
        `font-size="${line.size}" textLength="${line.width}" lengthAdjust="spacingAndGlyphs"` +
        frozenOpacity +
        (line.right ? ' text-anchor="end"' : '') +
        (line.className.includes('sc-title') ? ' font-weight="600"' : '') +
        `>${text}</text>`
      );
    })
    .join('')}</g>`;
}

/** Reveal the real total during the final tenth of the build, then hold. */
export function totalRevealCss(model: ChartModel): string {
  const anim = model.config.animation;
  if (!model.config.showTotal || !anim.animateTotal || anim.mode === 'none')
    return '';
  // Frozen renders bake the reveal opacity onto the total text itself, so the
  // keyframes would be dead weight (and resvg ignores them anyway).
  if (freezeProgress() !== null) return '';
  const id = makeId(model);
  const timeline = resolveTimeline(anim);
  const endFrac = timeline.buildSeconds / timeline.cycleSeconds;
  return (
    progressKeyframes(id('totalkf'), 'opacity', '0', '1', {
      startFrac: endFrac * 0.9,
      endFrac,
    }) +
    `@media (prefers-reduced-motion:no-preference){` +
    `.${id('total')}{animation:${id('totalkf')} ${timeline.cycleSeconds}s linear ` +
    `${timeline.delaySeconds}s ${timeline.iteration} both;}}`
  );
}

/** Renders sparse, collision-checked date labels below the plot. */
export function renderDates(
  model: ChartModel,
  layout: Layout,
  xForColumn: (index: number) => number,
  timeForColumn: (index: number) => number = (index) =>
    model.buckets[index]?.startTime ?? 0,
): string {
  if (
    !model.config.showXAxis ||
    !model.config.showDates ||
    model.buckets.length === 0
  ) {
    return '';
  }
  const size = model.config.axisFontSize;
  const scale = axisScale(model);
  const y = layout.plotTop + layout.plotHeight + Math.round(16 * scale);
  const labels: Array<{ x: number; text: string; width: number }> = [];
  const desired = Math.min(5, model.buckets.length);
  const step = Math.max(
    1,
    Math.floor((model.buckets.length - 1) / (desired - 1 || 1)),
  );
  const minGap = 64 * scale;
  let lastX = -Infinity;
  for (let i = 0; i < model.buckets.length; i += step) {
    const bucket = model.buckets[i];
    if (!bucket || bucket.startTime === 0) {
      continue;
    }
    const text = formatDate(timeForColumn(i), model.config.dateFormat);
    const width = Math.min(
      text.length * size * 0.62,
      layout.width - layout.padX * 2,
    );
    const px = Math.min(
      layout.width - layout.padX - width / 2,
      Math.max(layout.padX + width / 2, xForColumn(i)),
    );
    if (px - lastX < Math.max(minGap, width + 8)) {
      continue;
    }
    labels.push({
      x: px,
      text,
      width,
    });
    lastX = px;
  }
  if (labels.length === 0) {
    return '';
  }
  const text = labels
    .map(
      (label) =>
        `<text x="${label.x}" y="${y}" class="sc-m" font-size="${size}" ` +
        `text-anchor="middle" textLength="${label.width}" lengthAdjust="spacingAndGlyphs">${escapeText(label.text)}</text>`,
    )
    .join('');
  return `<g class="sc-dates">${text}</g>`;
}

/** Small "Star Chart" wordmark, controlled by the `logo` config. */
export function renderLogo(model: ChartModel, layout: Layout): string {
  if (!model.config.logo) {
    return '';
  }
  const x = layout.width - layout.padX;
  const y = layout.height - 8;
  return (
    `<text x="${x}" y="${y}" text-anchor="end" class="sc-m" font-size="9" ` +
    `opacity="0.8">\u2605 Star Chart</text>`
  );
}

/** Wraps document content in a complete, standalone SVG string. */
export function wrapDocument(params: {
  model: ChartModel;
  layout: Layout;
  style: string;
  defs?: string | undefined;
  body: string;
  titleId: string;
  descId: string;
}): string {
  const { model, layout, style, defs, body, titleId, descId } = params;
  const bg =
    model.config.background === 'transparent'
      ? ''
      : `<rect width="100%" height="100%" fill="${escapeAttr(
          model.config.background,
        )}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${layout.width}" height="${layout.height}" ` +
    `viewBox="0 0 ${layout.width} ${layout.height}" ` +
    `class="sc-root" role="img" aria-labelledby="${titleId} ${descId}">` +
    `<title id="${titleId}">${escapeText(chartTitle(model))}</title>` +
    `<desc id="${descId}">${escapeText(chartDescription(model))}</desc>` +
    `<style>${style}</style>` +
    (defs ? `<defs>${defs}</defs>` : '') +
    bg +
    body +
    `</svg>`
  );
}
