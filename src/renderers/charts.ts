import {
  line as d3line,
  area as d3area,
  curveMonotoneX,
  curveStepAfter,
  type CurveFactory,
} from 'd3-shape';
import type { AnimationConfig, ChartModel } from '../models/index.js';
import { coord, withCommas } from '../utils/numbers.js';
import { escapeText } from '../utils/svg.js';
import { formatDate } from '../utils/dates.js';
import {
  baseCss,
  buildThemeCss,
  makeId,
  renderDates,
  renderHeader,
  renderLogo,
  renderLegend,
  wrapDocument,
  totalRevealCss,
  type Layout,
} from './shared.js';
import {
  buildFrame,
  renderXAxis,
  renderYAxis,
  type PlotFrame,
} from './conventional.js';
import {
  columnWindow,
  inverseEasing,
  keyframePercent,
  progressKeyframes,
  resolveTimeline,
  type Timeline,
} from './animation.js';
import {
  barGrowScaleAt,
  freezeProgress,
  isFrozen,
  strokeDrawFractionAt,
  svgPathLength,
  wipeScaleAt,
} from './freeze.js';

export function chartCurve(model: ChartModel): CurveFactory {
  // Empty sub-week slots carry the last observation: do not interpolate growth
  // through them. A jump at the next interval endpoint denotes recorded data.
  const sparse = model.buckets.some((b) => b.observations === 0);
  return sparse ? curveStepAfter : curveMonotoneX;
}

export function toLayout(frame: PlotFrame): Layout {
  return {
    width: frame.width,
    height: frame.height,
    padX: frame.padX,
    padTop: frame.padTop,
    headerHeight: frame.headerHeight,
    plotTop: frame.plotTop,
    plotHeight: frame.plotHeight,
    plotWidth: frame.plotWidth,
    datesHeight: frame.datesHeight,
    footerHeight: frame.footerHeight,
  };
}

export function pointTitles(model: ChartModel, frame: PlotFrame): string {
  const titles = model.buckets
    .map((bucket, index) => {
      if (bucket.startTime === 0) {
        return '';
      }
      const point = frame.points[index];
      if (!point) {
        return '';
      }
      const date = `${formatDate(bucket.startTime, model.config.dateFormat)}–${formatDate(bucket.endTime, model.config.dateFormat)}`;
      const text = `${date}: ${withCommas(bucket.cumulative)} recorded stars at bucket end (+${withCommas(bucket.added)}; current week may be partial)`;
      return (
        `<circle cx="${coord(point.x)}" cy="${coord(point.y)}" r="6" ` +
        `fill="transparent"><title>${escapeText(text)}</title></circle>`
      );
    })
    .join('');
  return titles;
}

/** LTR clip-wipe animation shared by reveal/cascade/area/bar styles. */
export function wipeClip(
  frame: PlotFrame,
  id: (name: string) => string,
  anim: AnimationConfig,
  timeline: Timeline,
  padding = 0,
): { clipId: string; defs: string; css: string } {
  const clipId = id('wipe');
  const wipeCls = id('wipefill');
  const rectX = frame.plotLeft - padding;
  const rectY = frame.plotTop - Math.max(3, padding);
  const rectW = frame.plotWidth + padding * 2;
  const rectH = frame.plotHeight + Math.max(3, padding) * 2;
  const simultaneous = anim.direction === 'simultaneous';

  // Frozen render: bake the wipe's current reveal directly into the clip rect
  // geometry (resvg ignores the CSS transform), leaving the caller's
  // `<g clip-path>` wrapper untouched. Horizontal wipes shrink width from the
  // left edge; a simultaneous (vertical) wipe shrinks height from the bottom.
  const frozen = freezeProgress();
  if (frozen !== null) {
    const scale = wipeScaleAt(anim, timeline, frame.points.length, frozen);
    const x = rectX;
    const w = simultaneous ? rectW : rectW * scale;
    const h = simultaneous ? rectH * scale : rectH;
    const y = simultaneous ? rectY + rectH - h : rectY;
    const defs =
      `<clipPath id="${clipId}"><rect x="${coord(x)}" y="${coord(y)}" ` +
      `width="${coord(w)}" height="${coord(h)}"/></clipPath>`;
    return { clipId, defs, css: '' };
  }

  const defs =
    `<clipPath id="${clipId}"><rect class="${wipeCls}" ` +
    `x="${coord(rectX)}" y="${coord(rectY)}" ` +
    `width="${coord(rectW)}" height="${coord(rectH)}"/></clipPath>`;
  const timing =
    anim.style === 'cascade'
      ? `steps(${Math.max(1, frame.points.length)},end)`
      : simultaneous && anim.style === 'reveal'
        ? 'steps(1,end)'
        : anim.easing;
  const axis = simultaneous ? 'Y' : 'X';
  const kf = id('wipekf');
  let frames = progressKeyframes(
    kf,
    'transform',
    `scale${axis}(0)`,
    `scale${axis}(1)`,
    {
      startFrac: 0,
      endFrac: timeline.buildSeconds / timeline.cycleSeconds,
    },
  );
  if (anim.style === 'cascade') {
    const count = Math.max(1, frame.points.length);
    const stops = Array.from({ length: count + 1 }, (_, i) => {
      const pct = keyframePercent(
        (inverseEasing(anim.easing, i / count) * timeline.buildSeconds) /
          timeline.cycleSeconds,
      );
      return `${pct}%{transform:scale${axis}(${i / count});animation-timing-function:steps(1,end);}`;
    });
    frames = `@keyframes ${kf}{${stops.join('')}100%{transform:scale${axis}(1);}}`;
  }
  const css =
    frames +
    `@media (prefers-reduced-motion:no-preference){` +
    `.${wipeCls}{transform-box:fill-box;transform-origin:${simultaneous ? 'center bottom' : 'left center'};` +
    `animation:${kf} ${timeline.cycleSeconds}s ${timing} ` +
    `${timeline.delaySeconds}s ${timeline.iteration} both;}}`;
  return { clipId, defs, css };
}

export function commonBody(
  model: ChartModel,
  frame: PlotFrame,
  plot: string,
  xAxis = renderXAxis(frame),
): string {
  const layout = toLayout(frame);
  return (
    renderHeader(model, layout) +
    renderLegend(model) +
    xAxis +
    plot +
    renderDates(
      model,
      layout,
      frame.xForIndex,
      (index) => frame.points[index]?.time ?? 0,
    ) +
    renderLogo(model, layout)
  );
}

/** Cumulative line chart. */
export function renderLine(model: ChartModel): string {
  return renderLineLike(model, { axis: true, compact: false });
}

/** Compact sparkline. */
export function renderSparkline(model: ChartModel): string {
  return renderLineLike(model, { axis: false, compact: true });
}

function renderLineLike(
  model: ChartModel,
  opts: { axis: boolean; compact: boolean },
): string {
  const frame = buildFrame(model, opts);
  const id = makeId(model);
  const anim = model.config.animation;
  const timeline = resolveTimeline(anim);
  const animEnabled = anim.mode !== 'none';

  const generator = d3line<{ x: number; y: number }>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(chartCurve(model));
  const path = generator(frame.points.map((p) => ({ x: p.x, y: p.y }))) ?? '';

  const single = frame.points.length === 1 ? frame.points[0] : null;

  let animCss = '';
  let pathAttrs = '';
  let wipeDefs = '';
  let clipWrapOpen = '';
  let clipWrapClose = '';

  if (animEnabled && path) {
    if (
      anim.style === 'grow' &&
      anim.direction === 'chronological' &&
      !single
    ) {
      if (isFrozen()) {
        // Bake the stroke draw as an absolute dash: resvg ignores `pathLength`,
        // so convert the eased draw fraction into a concrete dash length over
        // the path's measured length (dash then a gap ≥ the full path).
        const eased = strokeDrawFractionAt(
          anim,
          timeline,
          freezeProgress() ?? 1,
        );
        const total = svgPathLength(path);
        const drawn = total * eased;
        pathAttrs = ` class="sc-stroke" stroke-dasharray="${coord(drawn)} ${coord(total)}"`;
      } else {
        const kf = id('draw');
        const drawCls = id('drawline');
        pathAttrs = ` pathLength="1" class="sc-stroke ${drawCls}"`;
        animCss =
          progressKeyframes(kf, 'stroke-dashoffset', '1', '0', {
            startFrac: 0,
            endFrac: timeline.buildSeconds / timeline.cycleSeconds,
          }) +
          `@media (prefers-reduced-motion:no-preference){` +
          `.${drawCls}{stroke-dasharray:1;stroke-dashoffset:0;` +
          `animation:${kf} ${timeline.cycleSeconds}s ${anim.easing} ` +
          `${timeline.delaySeconds}s ${timeline.iteration} both;}}`;
      }
    } else {
      const wipe = wipeClip(frame, id, anim, timeline);
      wipeDefs = wipe.defs;
      animCss = wipe.css;
      clipWrapOpen = `<g clip-path="url(#${wipe.clipId})">`;
      clipWrapClose = '</g>';
    }
  }

  const strokeWidth = opts.compact ? 1.75 : 2;
  const pathClass = pathAttrs || ' class="sc-stroke"';
  const pathEl = path
    ? `<path d="${path}"${pathClass} stroke-width="${strokeWidth}" ` +
      `stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  const dot = single
    ? `<circle class="sc-dot" cx="${coord(single.x)}" cy="${coord(single.y)}" r="3"/>`
    : '';

  const axis = renderYAxis(frame);
  const plot =
    axis +
    `<g aria-hidden="true">${clipWrapOpen}${pathEl}${dot}${clipWrapClose}</g>` +
    pointTitles(model, frame);

  const style =
    baseCss(model.config.fontFamily) +
    buildThemeCss(model) +
    animCss +
    totalRevealCss(model);

  const body = commonBody(model, frame, plot);
  return wrapDocument({
    model,
    layout: toLayout(frame),
    style,
    defs: wipeDefs || undefined,
    body,
    titleId: id('title'),
    descId: id('desc'),
  });
}

/** Cumulative area chart. */
export function renderArea(model: ChartModel): string {
  const frame = buildFrame(model, { axis: true, compact: false });
  const id = makeId(model);
  const anim = model.config.animation;
  const timeline = resolveTimeline(anim);
  const animEnabled = anim.mode !== 'none';

  const areaGen = d3area<{ x: number; y: number }>()
    .x((d) => d.x)
    .y0(frame.baselineY)
    .y1((d) => d.y)
    .curve(chartCurve(model));
  const lineGen = d3line<{ x: number; y: number }>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(chartCurve(model));
  const pts = frame.points.map((p) => ({ x: p.x, y: p.y }));
  const areaPath = areaGen(pts) ?? '';
  const linePath = lineGen(pts) ?? '';

  let wipeDefs = '';
  let animCss = '';
  let open = '';
  let close = '';
  if (animEnabled && areaPath) {
    const wipe = wipeClip(frame, id, anim, timeline);
    wipeDefs = wipe.defs;
    animCss = wipe.css;
    open = `<g clip-path="url(#${wipe.clipId})">`;
    close = '</g>';
  }

  const axis = renderYAxis(frame);
  const plot =
    axis +
    `<g aria-hidden="true">${open}` +
    (areaPath ? `<path d="${areaPath}" class="sc-area" opacity="0.22"/>` : '') +
    (linePath
      ? `<path d="${linePath}" class="sc-stroke" stroke-width="2" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>`
      : '') +
    `${close}</g>` +
    pointTitles(model, frame);

  const style =
    baseCss(model.config.fontFamily) +
    buildThemeCss(model) +
    animCss +
    totalRevealCss(model);
  const body = commonBody(model, frame, plot);
  return wrapDocument({
    model,
    layout: toLayout(frame),
    style,
    defs: wipeDefs || undefined,
    body,
    titleId: id('title'),
    descId: id('desc'),
  });
}

/** Cumulative bar chart. */
export function renderBar(model: ChartModel): string {
  const frame = buildFrame(model, { axis: true, compact: false });
  const id = makeId(model);
  const anim = model.config.animation;
  const timeline = resolveTimeline(anim);
  const animEnabled = anim.mode !== 'none';
  const n = frame.points.length;

  const barW = frame.barWidth;

  const growMode = animEnabled && anim.style === 'grow';
  const wipeMode = animEnabled && anim.style !== 'grow';
  const frozenGrow = growMode && isFrozen();

  let wipeDefs = '';
  let animCss = '';
  let open = '';
  let close = '';
  const growCls = id('bargrow');
  if (wipeMode) {
    const wipe = wipeClip(frame, id, anim, timeline);
    wipeDefs = wipe.defs;
    animCss = wipe.css;
    open = `<g clip-path="url(#${wipe.clipId})">`;
    close = '</g>';
  } else if (growMode && !frozenGrow) {
    animCss =
      `@media (prefers-reduced-motion:no-preference){` +
      `.${growCls}{transform-box:fill-box;transform-origin:center bottom;` +
      `}}`;
  }

  const bars: string[] = [];
  const growRules: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const point = frame.points[i];
    if (!point) {
      continue;
    }
    const barH = Math.max(0, frame.baselineY - point.y);
    const x = point.x - barW / 2;
    if (frozenGrow) {
      // Bake this bar's grow into static geometry, scaled from the baseline
      // (matching `transform-origin:center bottom`); resvg ignores the CSS
      // transform that would otherwise drive it.
      const scale = barGrowScaleAt(
        anim,
        columnWindow(i, n, anim, timeline),
        freezeProgress() ?? 1,
      );
      const h = barH * scale;
      const y = frame.baselineY - h;
      bars.push(
        `<rect class="sc-bar" x="${coord(x)}" y="${coord(y)}" ` +
          `width="${coord(barW)}" height="${coord(h)}" rx="1"/>`,
      );
      continue;
    }
    const barId = growMode ? `${growCls}-${i}` : '';
    const cls = growMode ? `sc-bar ${growCls} ${barId}` : 'sc-bar';
    bars.push(
      `<rect class="${cls}" x="${coord(x)}" y="${coord(point.y)}" ` +
        `width="${coord(barW)}" height="${coord(barH)}" rx="1"/>`,
    );
    if (growMode && barH > 0) {
      animCss += progressKeyframes(
        barId,
        'transform',
        'scaleY(0)',
        'scaleY(1)',
        columnWindow(i, n, anim, timeline),
      );
      growRules.push(
        `.${barId}{animation:${barId} ${timeline.cycleSeconds}s ` +
          `${anim.easing} ${timeline.delaySeconds}s ${timeline.iteration} both;}`,
      );
    }
  }
  if (growMode && !frozenGrow && growRules.length > 0) {
    animCss += `@media (prefers-reduced-motion:no-preference){${growRules.join('')}}`;
  }

  const axis = renderYAxis(frame);
  const plot =
    axis +
    `<g aria-hidden="true">${open}${bars.join('')}${close}</g>` +
    pointTitles(model, frame);

  const style =
    baseCss(model.config.fontFamily) +
    buildThemeCss(model) +
    animCss +
    totalRevealCss(model);
  const body = commonBody(model, frame, plot);
  return wrapDocument({
    model,
    layout: toLayout(frame),
    style,
    defs: wipeDefs || undefined,
    body,
    titleId: id('title'),
    descId: id('desc'),
  });
}
