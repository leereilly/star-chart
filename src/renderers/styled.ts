import {
  area as d3area,
  line as d3line,
  curveLinear,
  curveStepAfter,
  type CurveFactory,
} from 'd3-shape';
import type { ChartModel, RepositorySeries } from '../models/index.js';
import { configRepositories } from '../config/defaults.js';
import { seriesColor } from '../config/themes.js';
import { formatDate, MS_PER_WEEK } from '../utils/dates.js';
import { coord, compactNumber, withCommas } from '../utils/numbers.js';
import { escapeAttr, escapeText } from '../utils/svg.js';
import {
  buildFrame,
  renderYAxis,
  type PlotFrame,
  type PlotPoint,
} from './conventional.js';
import {
  chartCurve,
  commonBody,
  pointTitles,
  toLayout,
  wipeClip,
} from './charts.js';
import { contribGeometry } from './contributions.js';
import { resolveTimeline } from './animation.js';
import {
  baseCss,
  buildThemeCss,
  makeId,
  RenderError,
  totalRevealCss,
  wrapDocument,
} from './shared.js';

interface Composition {
  readonly plot: string;
  readonly defs?: string;
  readonly css?: string;
  readonly titles?: string;
  readonly yAxis?: string;
  readonly xAxis?: string;
}

/** New styles share a bounded, reduced-motion-safe reveal in every mode. */
function document(
  model: ChartModel,
  frame: PlotFrame,
  composition: Composition,
): string {
  const id = makeId(model);
  const anim = model.config.animation;
  const wipe =
    anim.mode === 'none'
      ? null
      : wipeClip(frame, id, anim, resolveTimeline(anim), 12);
  const plot =
    (composition.yAxis ?? renderYAxis(frame)) +
    (wipe ? `<g clip-path="url(#${wipe.clipId})">` : '<g>') +
    composition.plot +
    '</g>' +
    (composition.titles ?? pointTitles(model, frame));
  return wrapDocument({
    model,
    layout: toLayout(frame),
    titleId: id('title'),
    descId: id('desc'),
    defs: (composition.defs ?? '') + (wipe?.defs ?? ''),
    style:
      baseCss(model.config.fontFamily) +
      buildThemeCss(model) +
      '.sc-ink{fill:none;stroke:var(--sc-l4);}.sc-ink-fill{fill:var(--sc-l4);}' +
      (composition.css ?? '') +
      (wipe?.css ?? '') +
      totalRevealCss(model),
    body: commonBody(model, frame, plot, composition.xAxis),
  });
}

type XY = { x: number; y: number };

function line(points: readonly XY[], curve: CurveFactory): string {
  return (
    d3line<XY>()
      .x((p) => p.x)
      .y((p) => p.y)
      .curve(curve)(points) ?? ''
  );
}

function area(
  points: readonly XY[],
  frame: PlotFrame,
  curve: CurveFactory,
): string {
  return (
    d3area<XY>()
      .x((p) => p.x)
      .y0(frame.baselineY)
      .y1((p) => p.y)
      .curve(curve)(points) ?? ''
  );
}

function stroke(path: string, name: string, width = 2): string {
  return (
    `<path data-chart="${name}" d="${path}" class="sc-ink" ` +
    `stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

function singleDot(points: readonly XY[]): string {
  const point = points.length === 1 ? points[0] : undefined;
  return point
    ? `<circle class="sc-ink-fill" cx="${coord(point.x)}" cy="${coord(point.y)}" r="3"/>`
    : '';
}

export function renderStepLine(model: ChartModel): string {
  const frame = buildFrame(model, { axis: true, compact: false, inset: 4 });
  return document(model, frame, {
    plot:
      stroke(line(frame.points, curveStepAfter), 'step-line') +
      singleDot(frame.points),
  });
}

/** A value heatmap: every occupied tile in a column has the same intensity. */
export function renderGrid(model: ChartModel): string {
  const geometry = contribGeometry(model);
  const initial = buildFrame(model, {
    axis: true,
    compact: false,
    centered: true,
  });
  const height =
    model.config.height ??
    initial.plotTop +
      geometry.gridHeight +
      initial.datesHeight +
      initial.footerHeight;
  const base = buildFrame(
    { ...model, config: { ...model.config, height } },
    { axis: true, compact: false, centered: true },
  );
  const bottom = base.plotTop + geometry.gridHeight;
  const yForValue = (value: number): number =>
    bottom -
    ((value - base.yMin) / (base.yMax - base.yMin)) * geometry.gridHeight;
  const xForIndex = (index: number): number =>
    base.plotLeft + index * geometry.pitch + geometry.cell / 2;
  const frame: PlotFrame = {
    ...base,
    plotHeight: geometry.gridHeight,
    plotWidth: geometry.gridWidth,
    baselineY: bottom,
    xForIndex,
    yForValue,
    points: base.points.map((p) => ({
      ...p,
      x: xForIndex(p.index),
      y: yForValue(p.cumulative),
    })),
    yTicks: base.yTicks.map((t) => ({ value: t.value, y: yForValue(t.value) })),
  };
  const tiles = frame.points
    .map((point) => {
      const ratio = Math.max(
        0,
        Math.min(
          1,
          (point.cumulative - frame.yMin) / (frame.yMax - frame.yMin),
        ),
      );
      const filled = Math.ceil(ratio * geometry.rows);
      const intensity = Math.max(1, Math.ceil(ratio * 4));
      const cells = Array.from(
        { length: geometry.rows },
        (_, row) =>
          `<rect class="sc-${row < filled ? `l${intensity}` : 'empty'}" ` +
          `x="${coord(point.x - geometry.cell / 2)}" y="${coord(bottom - (row + 1) * geometry.pitch + geometry.gap)}" ` +
          `width="${geometry.cell}" height="${geometry.cell}" rx="${geometry.radius}"/>`,
      ).join('');
      return `<g data-column="${point.index}"><title>${escapeText(
        `${withCommas(point.cumulative)} recorded stars` +
          (point.time > 0
            ? ` at bucket end ${formatDate(model.buckets[point.index]?.endTime ?? point.time, model.config.dateFormat)}`
            : '') +
          '; tile height rounded up',
      )}</title>${cells}</g>`;
    })
    .join('');
  return document(model, frame, {
    plot: `<g data-chart="grid">${tiles}</g>`,
    titles: '',
  });
}

/** Actual observation endpoints, independent of display bucket coarsening. */
function observationPoints(model: ChartModel, frame: PlotFrame): PlotPoint[] {
  if (model.selectedWeeks.length === 0)
    return frame.points.filter((p) => p.time > 0);
  let cumulative = model.baseline;
  return model.selectedWeeks.map((week, index) => {
    cumulative += week.added;
    const time =
      model.selectedWeeks[index + 1]?.time ?? week.time + MS_PER_WEEK;
    return {
      index,
      time,
      cumulative,
      added: week.added,
      x: frame.xForTime(time),
      y: frame.yForValue(cumulative),
    };
  });
}

function milestoneStep(range: number): number {
  const target = Math.max(1, range / 6);
  const power = 10 ** Math.floor(Math.log10(target));
  return (
    (target / power <= 1
      ? 1
      : target / power <= 2
        ? 2
        : target / power <= 5
          ? 5
          : 10) * power
  );
}

function renderMilestones(model: ChartModel, filled: boolean): string {
  const frame = buildFrame(model, {
    axis: true,
    compact: false,
    observationDomain: true,
    inset: 8,
  });
  const points = observationPoints(model, frame);
  const step = milestoneStep(model.windowMax - model.baseline);
  let threshold = (Math.floor(model.baseline / step) + 1) * step;
  const events: Array<{ point: PlotPoint; thresholds: number[] }> = [];
  for (const point of points) {
    const thresholds: number[] = [];
    while (threshold <= point.cumulative) {
      thresholds.push(threshold);
      threshold += step;
    }
    if (thresholds.length) events.push({ point, thresholds });
  }
  const last = points[points.length - 1];
  if (events.length === 0 && last) events.push({ point: last, thresholds: [] });
  const occupied: Array<{ x: number; y: number; width: number }> = [];
  const markers = events
    .map(({ point, thresholds }) => {
      const crossed = thresholds.length
        ? thresholds.map(compactNumber).join(', ')
        : '';
      const text =
        thresholds.length > 1
          ? `${compactNumber(thresholds[0] ?? 0)}–${compactNumber(thresholds[thresholds.length - 1] ?? 0)}`
          : compactNumber(thresholds[0] ?? point.cumulative);
      const tooltip =
        `${formatDate(point.time, model.config.dateFormat)}: ${withCommas(point.cumulative)} recorded stars` +
        (crossed ? `; crossed ${crossed}` : '; latest observation');
      const width = text.length * 6.2 + 8;
      const x = Math.max(
        frame.plotLeft + width / 2,
        Math.min(frame.plotLeft + frame.plotWidth - width / 2, point.x),
      );
      const y = point.y - 12 < frame.plotTop ? point.y + 20 : point.y - 12;
      const collision = occupied.some(
        (b) =>
          Math.abs(b.x - x) < (b.width + width) / 2 && Math.abs(b.y - y) < 16,
      );
      if (!collision) occupied.push({ x, y, width });
      return (
        `<g data-observed="${point.cumulative}" data-time="${point.time}">` +
        `<title>${escapeText(tooltip)}</title>` +
        `<circle class="sc-ink-fill" cx="${coord(point.x)}" cy="${coord(point.y)}" r="4"/>` +
        (!collision
          ? `<text class="sc-t" x="${coord(x)}" y="${coord(Math.min(frame.baselineY - 4, y))}" ` +
            `text-anchor="middle" font-size="10">${escapeText(text)}</text>`
          : '') +
        '</g>'
      );
    })
    .join('');
  const start = model.selectedWeeks[0];
  const areaPoints = start
    ? [
        {
          x: frame.xForTime(start.time),
          y: frame.yForValue(model.baseline),
        },
        ...points,
      ]
    : points;
  const scatter = points
    .map(
      (p) =>
        `<circle class="sc-ink-fill" cx="${coord(p.x)}" cy="${coord(p.y)}" r="1.8" opacity="0.6"/>`,
    )
    .join('');
  const plot = filled
    ? `<path data-chart="milestone-area-fill" class="sc-ink-fill" opacity="0.18" d="${area(areaPoints, frame, curveStepAfter)}"/>` +
      stroke(line(areaPoints, curveStepAfter), 'milestone-area') +
      markers
    : `<g data-chart="milestone-scatter">${scatter}${markers}</g>`;
  return document(model, frame, { plot, titles: '' });
}

export function renderMilestoneScatter(model: ChartModel): string {
  return renderMilestones(model, false);
}

export function renderMilestoneArea(model: ChartModel): string {
  return renderMilestones(model, true);
}

function comparisonSeries(model: ChartModel): readonly RepositorySeries[] {
  if (!model.series?.length) {
    if (configRepositories(model.config).length > 1) {
      throw new RenderError(
        'clustered-bar needs independent repository histories. Use buildMultiRepositoryChartModel; aggregate data cannot reconstruct series.',
      );
    }
    return [
      {
        metadata: model.metadata,
        buckets: model.buckets,
        selectedWeeks: model.selectedWeeks,
        baseline: model.baseline,
        windowMax: model.windowMax,
        hasSyntheticWeeks: model.hasSyntheticWeeks,
      },
    ];
  }
  if (
    configRepositories(model.config).length > 1 &&
    model.series.length !== configRepositories(model.config).length
  ) {
    throw new RenderError(
      'clustered-bar needs one aligned series per configured repository.',
    );
  }
  for (const series of model.series) {
    if (
      !Number.isFinite(series.baseline) ||
      !Number.isFinite(series.windowMax) ||
      series.baseline < 0 ||
      series.windowMax < series.baseline ||
      series.buckets.length !== model.buckets.length ||
      series.buckets.some(
        (b, i) =>
          b.startTime !== model.buckets[i]?.startTime ||
          b.endTime !== model.buckets[i]?.endTime ||
          !Number.isFinite(b.cumulative) ||
          b.cumulative < series.baseline,
      )
    ) {
      throw new RenderError(
        'clustered-bar series must share the aggregate bucket boundaries and finite cumulative values.',
      );
    }
  }
  return model.series;
}

export function renderClusteredBar(model: ChartModel): string {
  const series = comparisonSeries(model);
  const frame = buildFrame(model, {
    axis: true,
    compact: false,
    centered: true,
    series,
  });
  const groupWidth = (frame.barWidth / 0.7) * 0.8;
  const slot = groupWidth / series.length;
  if (slot < 2) {
    throw new RenderError(
      'Cannot fit clustered-bar columns and repositories. Reduce columns or increase width (at least 2px per repository).',
    );
  }
  const id = makeId(model);
  const colors = (theme: 'light' | 'dark'): string =>
    series
      .map((_, index) => {
        const override =
          index < 4
            ? model.config.paletteOverrides[
                `level${index + 1}` as 'level1' | 'level2' | 'level3' | 'level4'
              ]
            : undefined;
        return `.${id(`series-${index}`)}{fill:${override ?? seriesColor(index, theme)};}`;
      })
      .join('');
  const css =
    model.config.theme === 'auto'
      ? colors('light') +
        `@media (prefers-color-scheme:dark){${colors('dark')}}`
      : colors(model.config.theme);
  const bars = model.buckets
    .map((_, index) =>
      series
        .map((s, seriesIndex) => {
          const bucket = s.buckets[index];
          if (!bucket)
            throw new RenderError('Missing aligned repository bucket.');
          const y = frame.yForValue(bucket.cumulative);
          const x =
            frame.xForIndex(index) - groupWidth / 2 + seriesIndex * slot;
          const tooltip =
            `${s.metadata.fullName}: ${withCommas(bucket.cumulative)} recorded stars` +
            (bucket.endTime > 0
              ? ` at ${formatDate(bucket.endTime, model.config.dateFormat)}`
              : '') +
            ` (+${withCommas(bucket.added)})`;
          return (
            `<rect data-repository="${escapeAttr(s.metadata.fullName)}" class="${id(`series-${seriesIndex}`)}" ` +
            `x="${coord(x)}" y="${coord(y)}" width="${coord(slot * 0.85)}" height="${coord(frame.baselineY - y)}">` +
            `<title>${escapeText(tooltip)}</title></rect>`
          );
        })
        .join(''),
    )
    .join('');
  return document(model, frame, {
    plot: `<g data-chart="clustered-bar">${bars}</g>`,
    css,
    titles: '',
  });
}

function renderNeon(model: ChartModel, stream: boolean): string {
  const frame = buildFrame(model, { axis: true, compact: false, inset: 12 });
  const id = makeId(model);
  const path = line(frame.points, chartCurve(model));
  const halo = id('halo');
  const gradient = id('stream');
  // User-space filter bounds avoid zero-sized single/flat path filter regions.
  const defs =
    `<filter id="${halo}" filterUnits="userSpaceOnUse" ` +
    `x="${coord(frame.plotLeft - 12)}" y="${coord(frame.plotTop - 12)}" ` +
    `width="${coord(frame.plotWidth + 24)}" height="${coord(frame.plotHeight + 24)}">` +
    '<feGaussianBlur stdDeviation="3"/></filter>' +
    (stream
      ? `<linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1">` +
        '<stop offset="0" class="sc-stream-stop" stop-opacity="0.55"/>' +
        '<stop offset="0.6" class="sc-stream-stop" stop-opacity="0.18"/>' +
        '<stop offset="1" class="sc-stream-stop" stop-opacity="0.02"/></linearGradient>'
      : '');
  const plot =
    (stream
      ? `<path data-chart="neon-glow-stream-fill" d="${area(frame.points, frame, chartCurve(model))}" fill="url(#${gradient})"/>`
      : '') +
    `<g filter="url(#${halo})" opacity="0.55">${stroke(path, 'neon-halo', 8)}${singleDot(frame.points)}</g>` +
    `<g opacity="0.2">${stroke(path, 'neon-aura', 6)}</g>` +
    stroke(path, stream ? 'neon-glow-stream' : 'neon-glow', 2) +
    singleDot(frame.points);
  return document(model, frame, {
    plot,
    defs,
    css: '.sc-stream-stop{stop-color:var(--sc-l4);}',
  });
}

export function renderNeonGlow(model: ChartModel): string {
  return renderNeon(model, false);
}

export function renderNeonGlowStream(model: ChartModel): string {
  return renderNeon(model, true);
}

export function renderAsciiTerminal(model: ChartModel): string {
  const frame = buildFrame(model, {
    axis: true,
    compact: false,
    centered: true,
  });
  const rows = model.config.rows;
  const columns = model.buckets.length;
  const borderColumns = model.config.showYAxis ? 2 : 0;
  const cellWidth = frame.plotWidth / (columns + borderColumns);
  const rowHeight =
    frame.plotHeight / (rows + (model.config.showXAxis ? 1 : 0));
  const fontSize = Math.min(16, rowHeight * 0.9, cellWidth / 0.62);
  if (fontSize < 5) {
    throw new RenderError(
      'Cannot fit ascii-terminal resolution. Reduce rows/columns or increase width/height.',
    );
  }
  const heights = model.buckets.map((bucket) =>
    Math.ceil(
      rows *
        Math.max(
          0,
          Math.min(
            1,
            (bucket.cumulative - frame.yMin) / (frame.yMax - frame.yMin),
          ),
        ),
    ),
  );
  const lines = Array.from({ length: rows }, (_, row) => {
    const level = rows - row;
    return (
      (model.config.showYAxis ? '|' : '') +
      heights
        .map((height) => (height === level ? '*' : height > level ? '#' : ' '))
        .join('') +
      (model.config.showYAxis ? '|' : '')
    );
  });
  const textAttributes = `class="sc-ink-fill" xml:space="preserve" font-family="monospace" font-size="${coord(fontSize)}"`;
  const text =
    `<text data-chart="ascii-terminal" ${textAttributes}>` +
    lines
      .map(
        (row, index) =>
          `<tspan x="${frame.plotLeft}" y="${coord(frame.plotTop + (index + 0.8) * rowHeight)}" ` +
          `textLength="${coord(frame.plotWidth)}" lengthAdjust="spacingAndGlyphs">${row}</tspan>`,
      )
      .join('') +
    '</text>';
  const dataHeight = rows * rowHeight;
  const terminalFrame = {
    ...frame,
    baselineY: frame.plotTop + dataHeight,
    xForIndex: (index: number) =>
      frame.plotLeft + (index + 0.5 + borderColumns / 2) * cellWidth,
    yTicks: frame.yTicks.map((tick) => ({
      value: tick.value,
      y:
        frame.plotTop +
        (dataHeight * (frame.yMax - tick.value)) / (frame.yMax - frame.yMin),
    })),
  };
  // The terminal border is the X axis, not another row below the numeric zero.
  const border =
    (model.config.showYAxis ? '+' : '') +
    '-'.repeat(columns) +
    (model.config.showYAxis ? '+' : '');
  const xAxis = model.config.showXAxis
    ? `<g class="sc-x-axis"><text ${textAttributes}>` +
      `<tspan x="${frame.plotLeft}" y="${coord(terminalFrame.baselineY)}" dominant-baseline="middle" ` +
      `textLength="${coord(frame.plotWidth)}" lengthAdjust="spacingAndGlyphs">${border}</tspan>` +
      '</text></g>'
    : '';
  return document(model, terminalFrame, {
    plot: text,
    xAxis,
    titles: '',
  });
}

/** Perturb mid-segments only: true observations remain exact anchors. */
function sketchPath(
  points: readonly XY[],
  frame: PlotFrame,
  phase: number,
  sparse: boolean,
): string {
  const expanded: XY[] = [];
  for (const [index, point] of points.entries()) {
    const previous = points[index - 1];
    if (previous) {
      if (sparse) {
        expanded.push({
          x: (previous.x + point.x) / 2,
          y: Math.max(
            frame.plotTop,
            Math.min(
              frame.baselineY,
              previous.y + Math.sin(index * 2.399 + phase) * 0.7,
            ),
          ),
        });
        expanded.push({ x: point.x, y: previous.y });
      } else
        expanded.push({
          x: (previous.x + point.x) / 2,
          y: Math.max(
            frame.plotTop,
            Math.min(
              frame.baselineY,
              (previous.y + point.y) / 2 +
                Math.sin(index * 2.399 + phase) * 1.4,
            ),
          ),
        });
    }
    expanded.push(point);
  }
  return line(expanded, curveLinear);
}

export function renderHandDrawn(model: ChartModel): string {
  const frame = buildFrame(model, { axis: true, compact: false, inset: 4 });
  const id = makeId(model);
  const hatch = id('hatch');
  const sparse = model.buckets.some((b) => b.observations === 0);
  const defs =
    `<pattern id="${hatch}" patternUnits="userSpaceOnUse" width="8" height="8">` +
    '<path class="sc-ink" d="M-2,8L8,-2M6,10L10,6" stroke-width="0.8" opacity="0.45"/></pattern>';
  return document(model, frame, {
    defs,
    plot:
      `<path data-chart="sketch-fill" d="${area(frame.points, frame, sparse ? curveStepAfter : curveLinear)}" fill="url(#${hatch})"/>` +
      stroke(
        sketchPath(frame.points, frame, 0, sparse),
        'sketch-primary',
        1.8,
      ) +
      `<g opacity="0.5">${stroke(sketchPath(frame.points, frame, 2, sparse), 'sketch-secondary', 0.9)}</g>` +
      singleDot(frame.points),
  });
}
