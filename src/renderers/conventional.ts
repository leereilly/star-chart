import { scaleLinear, scaleUtc } from 'd3-scale';
import { max as d3max, min as d3min } from 'd3-array';
import type { ChartModel, RepositorySeries } from '../models/index.js';
import { coord, compactNumber } from '../utils/numbers.js';
import {
  axisGutter,
  legendHeight as measureLegend,
  datesHeight as measureDates,
  headerHeight as measureHeader,
  RenderError,
} from './shared.js';

export interface PlotPoint {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly time: number;
  readonly cumulative: number;
  readonly added: number;
}

export interface PlotFrame {
  readonly width: number;
  readonly height: number;
  readonly padX: number;
  readonly padTop: number;
  readonly headerHeight: number;
  readonly plotLeft: number;
  readonly plotTop: number;
  readonly plotWidth: number;
  readonly plotHeight: number;
  readonly datesHeight: number;
  readonly footerHeight: number;
  readonly points: PlotPoint[];
  readonly yTicks: Array<{ value: number; y: number }>;
  readonly yMin: number;
  readonly yMax: number;
  readonly xForIndex: (index: number) => number;
  readonly xForTime: (time: number) => number;
  readonly yForValue: (value: number) => number;
  readonly baselineY: number;
  readonly barWidth: number;
  /** Font size in px for the y-axis tick labels. */
  readonly axisFontSize: number;
  readonly showXAxis: boolean;
  readonly sketchAxes?: boolean;
}

export interface FrameOptions {
  /** Historical style hint; the resolved showYAxis configuration takes precedence. */
  readonly axis: boolean;
  /** Reserve space for date labels + logo. */
  readonly compact: boolean;
  readonly centered?: boolean;
  readonly series?: readonly RepositorySeries[] | undefined;
  readonly legendHeight?: number;
  /** Use the complete observation interval, not just bucket endpoints. */
  readonly observationDomain?: boolean;
  /** Keep glow and sketch strokes inside the SVG without clipping them. */
  readonly inset?: number;
}

/** Builds a conventional-chart plotting frame with genuine D3 scales. */
export function buildFrame(
  model: ChartModel,
  options: FrameOptions,
): PlotFrame {
  const cfg = model.config;
  const padX = 16;
  const padTop = 12;
  const headerHeight =
    measureHeader(model) + (options.legendHeight ?? measureLegend(model));
  const datesHeight = measureDates(model);
  const footerHeight = cfg.logo ? 16 : 8;

  // The y-axis gutter scales with the legend so wider tick labels are not
  // squeezed into a fixed 40px band.
  const plotLeft = padX + axisGutter(model);
  const inset = options.inset ?? 0;
  const plotTop = padTop + headerHeight + inset;
  const width = cfg.width;
  const naturalPlotHeight = options.compact
    ? Math.max(40, Math.round(width * 0.18))
    : Math.max(160, Math.round(width * 0.42));
  const height =
    cfg.height ?? plotTop + naturalPlotHeight + datesHeight + footerHeight;
  const plotHeight = height - plotTop - datesHeight - footerHeight - inset;
  const plotWidth = width - plotLeft - padX - inset;
  if (plotHeight < 24 || plotWidth < 24) {
    throw new RenderError(
      `Cannot fit the header, plot and footer in width ${width}, height ${height}. ` +
        'Increase width/height or use auto height, or hide header/date/logo elements.',
    );
  }

  const n = model.buckets.length;
  const bars = cfg.style === 'bar' || options.centered === true;
  const times = model.buckets.map((b) =>
    bars ? (b.startTime + b.endTime) / 2 : b.endTime,
  );
  const hasTimes =
    times.every((t) => t > 0) &&
    (n > 1 || (options.observationDomain === true && n === 1));
  const slot = plotWidth / Math.max(1, n);

  const xScale = hasTimes
    ? scaleUtc()
        .domain(
          bars || options.observationDomain
            ? [
                model.buckets[0]?.startTime ?? 0,
                model.buckets[n - 1]?.endTime ?? 1,
              ]
            : [times[0] ?? 0, times[n - 1] ?? 1],
        )
        .range([plotLeft, plotLeft + plotWidth])
    : null;

  const xForIndex = (index: number): number => {
    if (xScale && hasTimes) {
      return xScale(times[index] ?? 0);
    }
    if (n <= 1) {
      return plotLeft + plotWidth / 2;
    }
    return plotLeft + (bars ? (index + 0.5) / n : index / (n - 1)) * plotWidth;
  };

  const values = options.series?.length
    ? options.series.flatMap((series) =>
        series.buckets.map((b) => b.cumulative),
      )
    : model.buckets.map((b) => b.cumulative);
  const dataMax = d3max(values) ?? 0;
  const dataMin = d3min(values) ?? 0;
  const baseline = options.series?.length
    ? Math.min(...options.series.map((series) => series.baseline))
    : model.baseline;
  const windowMax = options.series?.length
    ? Math.max(...options.series.map((series) => series.windowMax))
    : model.windowMax;
  const yMin = cfg.scale === 'visible' ? Math.min(baseline, dataMin) : 0;
  let yMax = cfg.scale === 'visible' ? Math.max(windowMax, dataMax) : dataMax;
  if (yMax <= yMin) {
    yMax = yMin + 1; // flat-domain guard
  }

  const yScale = scaleLinear()
    .domain([yMin, yMax])
    .range([plotTop + plotHeight, plotTop]);

  const points: PlotPoint[] = model.buckets.map((bucket, index) => ({
    index,
    x: xForIndex(index),
    y: yScale(bucket.cumulative),
    time: times[index] ?? 0,
    cumulative: bucket.cumulative,
    added: bucket.added,
  }));

  const tickCount = cfg.showYAxis
    ? Math.max(1, Math.min(4, Math.floor(plotHeight / (cfg.axisFontSize * 2))))
    : 0;
  const candidateTicks =
    tickCount > 0
      ? yScale.ticks(tickCount).map((value) => ({ value, y: yScale(value) }))
      : [];
  const yTicks = candidateTicks.filter(
    (tick, i) =>
      i === 0 ||
      Math.abs(tick.y - (candidateTicks[0]?.y ?? tick.y)) >=
        cfg.axisFontSize * 1.5,
  );

  return {
    width,
    height,
    padX,
    padTop,
    headerHeight,
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
    datesHeight,
    footerHeight,
    points,
    yTicks,
    yMin,
    yMax,
    xForIndex,
    xForTime: (time: number) =>
      xScale ? xScale(time) : plotLeft + plotWidth / 2,
    yForValue: (value: number) => yScale(value),
    baselineY: plotTop + plotHeight,
    axisFontSize: cfg.axisFontSize,
    showXAxis: cfg.showXAxis,
    sketchAxes: cfg.style === 'hand-drawn',
    barWidth:
      bars && xScale
        ? Math.min(
            ...model.buckets.map(
              (b) => xScale(b.endTime) - xScale(b.startTime),
            ),
          ) * 0.7
        : slot * 0.7,
  };
}

export type AxisFrame = Pick<
  PlotFrame,
  | 'plotLeft'
  | 'plotTop'
  | 'plotWidth'
  | 'baselineY'
  | 'axisFontSize'
  | 'padX'
  | 'yTicks'
  | 'showXAxis'
  | 'sketchAxes'
>;

export function renderXAxis(frame: AxisFrame): string {
  return frame.showXAxis
    ? `<g class="sc-x-axis">${
        frame.sketchAxes
          ? `<path class="sc-axis" fill="none" stroke-width="1.2" d="M${coord(frame.plotLeft)},${coord(frame.baselineY)}L${coord(frame.plotLeft + frame.plotWidth / 2)},${coord(frame.baselineY - 0.7)}L${coord(frame.plotLeft + frame.plotWidth)},${coord(frame.baselineY)}"/>`
          : `<line class="sc-axis" x1="${coord(frame.plotLeft)}" x2="${coord(frame.plotLeft + frame.plotWidth)}" y1="${coord(frame.baselineY)}" y2="${coord(frame.baselineY)}"/>`
      }</g>`
    : '';
}

/** Renders a light y-axis, retaining precision when compact labels collide. */
export function renderYAxis(frame: AxisFrame): string {
  if (frame.yTicks.length === 0) {
    return '';
  }
  const parts: string[] = ['<g class="sc-y-axis">'];
  parts.push(
    frame.sketchAxes
      ? `<path class="sc-axis" fill="none" stroke-width="1.2" d="M${coord(frame.plotLeft)},${coord(frame.plotTop)}L${coord(frame.plotLeft + 0.8)},${coord((frame.plotTop + frame.baselineY) / 2)}L${coord(frame.plotLeft)},${coord(frame.baselineY)}"/>`
      : `<line class="sc-axis" x1="${coord(frame.plotLeft)}" x2="${coord(frame.plotLeft)}" y1="${coord(frame.plotTop)}" y2="${coord(frame.baselineY)}"/>`,
  );
  const size = frame.axisFontSize;
  const labels = frame.yTicks.map((tick) =>
    tick.value < 1000 && !Number.isInteger(tick.value)
      ? String(Math.round(tick.value * 100) / 100)
      : compactNumber(tick.value),
  );
  const needPrecision = new Set(labels).size < labels.length;
  for (const [index, tick] of frame.yTicks.entries()) {
    const label = needPrecision
      ? tick.value.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : (labels[index] ?? '');
    const labelWidth = Math.min(
      label.length * size * 0.62,
      frame.plotLeft - frame.padX - 6,
    );
    parts.push(
      `<line class="sc-axis" x1="${frame.plotLeft}" y1="${coord(tick.y)}" ` +
        `x2="${coord(frame.plotLeft + frame.plotWidth)}" y2="${coord(tick.y)}" ` +
        `stroke-width="1" opacity="0.35"/>`,
    );
    parts.push(
      `<text class="sc-m" x="${frame.plotLeft - 6}" y="${coord(tick.y + size * 0.3)}" ` +
        `font-size="${size}" text-anchor="end" textLength="${labelWidth}" ` +
        `lengthAdjust="spacingAndGlyphs" aria-label="${tick.value} recorded stars">${label}</text>`,
    );
  }
  parts.push('</g>');
  return parts.join('');
}
