import type { Bucket, ChartModel } from '../models/index.js';
import {
  normalizeChartModel,
  type ChartModelInput,
} from '../config/defaults.js';
import { coord, withCommas } from '../utils/numbers.js';
import { escapeText } from '../utils/svg.js';
import { formatDate } from '../utils/dates.js';
import {
  baseCss,
  axisGutter,
  legendHeight,
  renderLegend,
  buildThemeCss,
  datesHeight as measureDates,
  headerHeight as measureHeader,
  makeId,
  renderDates,
  renderHeader,
  renderLogo,
  wrapDocument,
  totalRevealCss,
  RenderError,
  type Layout,
} from './shared.js';
import {
  columnSchedule,
  columnWindow,
  keyframesForColumn,
  resolveTimeline,
} from './animation.js';
import { renderXAxis, renderYAxis, type AxisFrame } from './conventional.js';

export { RenderError } from './shared.js';

/**
 * A single frozen animation frame: the number of exposed cells (from the
 * bottom) for each column at one moment of the build. Consumed by the GIF
 * pipeline to rasterize the CSS animation into discrete frames.
 */
export interface ContribFrame {
  readonly exposed: readonly number[];
}

export interface ContribGeometry {
  readonly cols: number;
  readonly rows: number;
  readonly pitch: number;
  readonly cell: number;
  readonly gap: number;
  readonly radius: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
}

const GITHUB_GAP_RATIO = 3 / 10;
const GITHUB_RADIUS_RATIO = 2 / 10;

/** Computes contribution grid geometry, honouring auto/explicit cell config. */
export function contribGeometry(input: ChartModelInput): ContribGeometry {
  const model = normalizeChartModel(input);
  const cfg = model.config;
  const cols = model.buckets.length;
  const rows = cfg.rows;
  const padX = 16;
  const innerWidth = cfg.width - padX * 2 - axisGutter(model);
  const innerHeight =
    cfg.height === null
      ? Infinity
      : cfg.height -
        12 -
        measureHeader(model) -
        legendHeight(model) -
        measureDates(model) -
        (cfg.logo ? 16 : 8);
  const maxCell =
    cfg.cellSize ??
    Math.floor(Math.min(innerWidth / Math.max(1, cols), innerHeight / rows));
  const minCell = cfg.cellSize ?? Math.max(3, (cfg.cellRadius ?? 0) * 2);
  for (let cell = maxCell; cell >= Math.max(3, minCell); cell -= 1) {
    const desiredGap =
      cfg.cellGap ??
      clampInt(cell * GITHUB_GAP_RATIO, 1, cfg.cellSize === null ? 4 : 6);
    const minimumGap = cfg.cellGap ?? desiredGap;
    for (let gap = desiredGap; gap >= minimumGap; gap -= 1) {
      const pitch = cell + gap;
      const gridWidth = cols * pitch - gap;
      const gridHeight = rows * pitch - gap;
      const radius =
        cfg.cellRadius ??
        Math.min(
          Math.floor(cell / 2),
          clampInt(cell * GITHUB_RADIUS_RATIO, 1, 3),
        );
      if (
        gridWidth <= innerWidth &&
        gridHeight <= innerHeight &&
        radius <= cell / 2
      ) {
        return { cols, rows, pitch, cell, gap, radius, gridWidth, gridHeight };
      }
    }
  }
  throw new RenderError(
    `Cannot fit ${cols} columns × ${rows} rows in width ${cfg.width}` +
      `${cfg.height === null ? '' : ` and height ${cfg.height}`} with legible square cells (minimum 3px) and the requested cell_size/gap/radius. ` +
      'Increase width/height, reduce columns/rows or explicit cell settings, or use auto sizing.',
  );
}

/**
 * Computes the integer cell height for a cumulative value under the selected
 * scale. Positive values always get at least one cell; the window maximum
 * fills all rows.
 */
export function columnHeight(
  input: ChartModelInput,
  cumulative: number,
): number {
  const model = normalizeChartModel(input);
  const { rows, scale } = model.config;
  const max = model.windowMax;
  const baseline = model.baseline;

  if (scale === 'visible') {
    const denom = max - baseline;
    if (denom <= 0) {
      return 0;
    }
    const num = cumulative - baseline;
    if (num <= 0) {
      return 0;
    }
    const h = Math.round((num / denom) * rows);
    return clampInt(Math.max(h, 1), 0, rows);
  }

  if (max <= 0 || cumulative <= 0) {
    return 0;
  }
  const h = Math.round((cumulative / max) * rows);
  return clampInt(Math.max(h, 1), 0, rows);
}

/** Colour class for the k-th cell from the top of a filled column. */
export function tipClassFromTop(kFromTop: number): string {
  if (kFromTop === 0) {
    return 'sc-l4';
  }
  if (kFromTop === 1) {
    return 'sc-l3';
  }
  if (kFromTop === 2) {
    return 'sc-l2';
  }
  return 'sc-l1';
}

/** Renders the contributions chart. */
export function renderContributions(
  model: ChartModel,
  frame?: ContribFrame,
): string {
  const geo = contribGeometry(model);
  const id = makeId(model);
  const padX = 16;
  const padTop = 12;
  const headerHeight = measureHeader(model) + legendHeight(model);
  const datesHeight = measureDates(model);
  const footerHeight = model.config.logo ? 16 : 8;

  // Patterns are anchored to the grid origin; only relative transforms need
  // to be pitch multiples to keep the moving tips aligned.
  const plotTop = padTop + headerHeight;
  const width = model.config.width;
  const gridX =
    axisGutter(model) + (width - axisGutter(model) - geo.gridWidth) / 2;

  const naturalHeight = plotTop + geo.gridHeight + datesHeight + footerHeight;
  const height = model.config.height ?? naturalHeight;

  const layout: Layout = {
    width,
    height,
    padX,
    padTop,
    headerHeight,
    plotTop,
    plotHeight: geo.gridHeight,
    plotWidth: geo.gridWidth,
    datesHeight,
    footerHeight,
  };

  const xForColumn = (index: number): number =>
    gridX + index * geo.pitch + geo.cell / 2;

  const heights = model.buckets.map((bucket) =>
    columnHeight(model, bucket.cumulative),
  );

  const clipId = id('plotclip');
  const emptyPatId = id('empty');
  const l1PatId = id('l1');
  const defs = buildDefs(geo, clipId, emptyPatId, l1PatId, gridX, plotTop);

  const anim = model.config.animation;
  // A frozen frame paints a single moment of the build with no CSS animation.
  const framing = frame !== undefined;
  const animEnabled = !framing && anim.mode !== 'none';
  const timeline = resolveTimeline(anim);

  const columnsSvg: string[] = [];
  const keyframes: string[] = [];
  const animRules: string[] = [];

  for (let j = 0; j < geo.cols; j += 1) {
    const h = heights[j] ?? 0;
    const colX = gridX + j * geo.pitch;
    const exposed = framing
      ? Math.max(0, Math.min(h, frame.exposed[j] ?? 0))
      : h;
    const finalTy = (geo.rows - exposed) * geo.pitch;
    const colClass = id(`col${j}`);
    const bucket = model.buckets[j];
    const title = bucket ? columnTitle(model, bucket) : '';
    const stack = buildColumnStack(
      geo,
      h,
      colX,
      plotTop,
      l1PatId,
      colClass,
      finalTy,
      framing,
    );
    columnsSvg.push(`<g>${title}${stack}</g>`);

    if (animEnabled && h > 0) {
      const window = columnWindow(j, geo.cols, anim, timeline);
      const schedule = columnSchedule({
        style: anim.style,
        easing: anim.easing,
        height: h,
        index: j,
        columns: geo.cols,
        rows: geo.rows,
        window,
        cascadeColumnFrac: 0,
        cascadeRowFrac: 0,
      });
      keyframes.push(
        keyframesForColumn(colClass, schedule, geo.rows, geo.pitch),
      );
      animRules.push(
        `.${colClass}{animation:${colClass} ${timeline.cycleSeconds}s ` +
          `linear ${timeline.delaySeconds}s ${timeline.iteration} both;}`,
      );
    }
  }

  const plot =
    `<g clip-path="url(#${clipId})" aria-hidden="true">` +
    `<rect x="${gridX}" y="${plotTop}" width="${coord(geo.gridWidth)}" ` +
    `height="${coord(geo.gridHeight)}" fill="url(#${emptyPatId})"/>` +
    columnsSvg.join('') +
    `</g>`;

  const emptyNote = model.isEmpty
    ? `<text x="${width / 2}" y="${plotTop + geo.gridHeight / 2}" ` +
      `class="sc-m" font-size="12" text-anchor="middle">` +
      `No recorded additions yet</text>`
    : '';

  const style =
    baseCss(model.config.fontFamily) +
    buildThemeCss(model) +
    animationCss(keyframes, animRules) +
    (framing ? '' : totalRevealCss(model));

  const min = model.config.scale === 'visible' ? model.baseline : 0;
  const range = model.windowMax - min;
  const tickCount = Math.max(
    1,
    Math.min(
      4,
      geo.rows,
      Math.floor(geo.gridHeight / (model.config.axisFontSize * 2)),
    ),
  );
  const levels = [
    ...new Set(
      Array.from({ length: tickCount + 1 }, (_, i) =>
        Math.round((i * geo.rows) / tickCount),
      ),
    ),
  ];
  const axisFrame: AxisFrame = {
    plotLeft: gridX,
    plotTop,
    plotWidth: geo.gridWidth,
    baselineY: plotTop + geo.gridHeight,
    padX: gridX - axisGutter(model),
    axisFontSize: model.config.axisFontSize,
    showXAxis: model.config.showXAxis,
    yTicks: !model.config.showYAxis
      ? []
      : range <= 0 || geo.gridHeight < model.config.axisFontSize * 1.5
        ? [{ value: min, y: plotTop + geo.gridHeight }]
        : levels.map((row) => ({
            value: min + (range * row) / geo.rows,
            y:
              row === 0
                ? plotTop + geo.gridHeight
                : plotTop + (geo.rows - row) * geo.pitch,
          })),
  };
  const body =
    renderHeader(model, layout) +
    renderLegend(model) +
    renderYAxis(axisFrame) +
    renderXAxis(axisFrame) +
    plot +
    emptyNote +
    renderDates(model, layout, xForColumn) +
    renderLogo(model, layout);

  return wrapDocument({
    model,
    layout,
    style,
    defs,
    body,
    titleId: id('title'),
    descId: id('desc'),
  });
}

function buildDefs(
  geo: ContribGeometry,
  clipId: string,
  emptyPatId: string,
  l1PatId: string,
  gridX: number,
  plotTop: number,
): string {
  const square = (cls: string): string =>
    `<rect x="0" y="0" width="${geo.cell}" height="${geo.cell}" ` +
    `rx="${geo.radius}" ry="${geo.radius}" class="${cls}"/>`;
  const pattern = (patId: string, cls: string): string =>
    `<pattern id="${patId}" x="${gridX}" y="${plotTop}" ` +
    `width="${geo.pitch}" height="${geo.pitch}" ` +
    `patternUnits="userSpaceOnUse">${square(cls)}</pattern>`;
  const clip =
    `<clipPath id="${clipId}"><rect x="${gridX}" y="${plotTop}" ` +
    `width="${coord(geo.gridWidth)}" ` +
    `height="${coord(geo.gridHeight)}"/></clipPath>`;
  return pattern(emptyPatId, 'sc-empty') + pattern(l1PatId, 'sc-l1') + clip;
}

/**
 * Builds a single column's translated colour stack: l4/l3/l2 tips over a
 * continuing l1 pattern. Only a vertical (pitch-multiple) transform animates,
 * so cell patterns remain aligned at every step.
 */
function buildColumnStack(
  geo: ContribGeometry,
  height: number,
  colX: number,
  plotTop: number,
  l1PatId: string,
  colClass: string,
  finalTy: number,
  attrTransform: boolean,
): string {
  if (height <= 0) {
    return '';
  }
  const cellRect = (yOffset: number, cls: string): string =>
    `<rect x="${colX}" y="${plotTop + yOffset}" width="${geo.cell}" ` +
    `height="${geo.cell}" rx="${geo.radius}" ry="${geo.radius}" ` +
    `class="${cls}"/>`;

  const tips: string[] = [cellRect(0, 'sc-l4')];
  if (height >= 2) {
    tips.push(cellRect(geo.pitch, 'sc-l3'));
  }
  if (height >= 3) {
    tips.push(cellRect(geo.pitch * 2, 'sc-l2'));
  }
  const l1 =
    height >= 4
      ? `<rect x="${colX}" y="${plotTop + geo.pitch * 3}" ` +
        `width="${geo.cell}" height="${coord(geo.rows * geo.pitch)}" ` +
        `fill="url(#${l1PatId})"/>`
      : '';

  // Frozen frames use the SVG `transform` attribute (understood by raster
  // back-ends such as resvg); the animated document uses the CSS `transform`
  // property so keyframes can drive it.
  const placement = attrTransform
    ? `transform="translate(0 ${coord(finalTy)})"`
    : `style="transform:translateY(${coord(finalTy)}px)"`;

  return `<g class="${colClass}" ${placement}>` + tips.join('') + l1 + `</g>`;
}

function columnTitle(model: ChartModel, bucket: Bucket): string {
  if (bucket.startTime === 0) {
    return '';
  }
  const date = `${formatDate(bucket.startTime, model.config.dateFormat)}–${formatDate(bucket.endTime, model.config.dateFormat)}`;
  const text = `${date}: ${withCommas(bucket.cumulative)} stars at bucket end (+${withCommas(
    bucket.added,
  )}; current week may be partial)`;
  return `<title>${escapeText(text)}</title>`;
}

function animationCss(keyframes: string[], rules: string[]): string {
  if (keyframes.length === 0) {
    return '';
  }
  return (
    keyframes.join('') +
    `@media (prefers-reduced-motion:no-preference){${rules.join('')}}`
  );
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
