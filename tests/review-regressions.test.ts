import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { buildChartModel } from '../src/history/model.js';
import { renderChart } from '../src/renderers/index.js';
import { buildFrame } from '../src/renderers/conventional.js';
import { datesHeight, legendHeight } from '../src/renderers/shared.js';
import {
  columnHeight,
  contribGeometry,
} from '../src/renderers/contributions.js';
import { renderStarChart } from '../src/lib.js';
import {
  DEFAULT_AXIS_FONT_SIZE,
  DEFAULT_COLUMNS,
  DEFAULT_ROWS,
  type ChartConfigInput,
} from '../src/config/defaults.js';
import { columnWindow, resolveTimeline } from '../src/renderers/animation.js';
import type { ChartStyle } from '../src/models/index.js';
import {
  FIXED_NOW,
  MS_WEEK,
  checkSvg,
  historyFromAdds,
  makeConfig,
  makeMetadata,
  withoutLegend,
} from './helpers/index.js';

const styles: ChartStyle[] = [
  'contributions',
  'line',
  'area',
  'bar',
  'sparkline',
];
function model(style: ChartStyle, raw: Record<string, string> = {}, weeks = 4) {
  return buildChartModel(
    makeConfig({
      style,
      columns: '4',
      weeks: String(weeks),
      rows: '10',
      ...raw,
    }),
    makeMetadata({ stargazersCount: Number.MAX_SAFE_INTEGER }),
    historyFromAdds(Array.from({ length: weeks }, (_, i) => i + 1)),
    { asOf: FIXED_NOW },
  );
}
function document(svg: string) {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}
function elements(svg: string, tag: string) {
  return Array.from(document(svg).getElementsByTagName(tag));
}
function attr(el: ReturnType<typeof elements>[number], name: string) {
  return Number(el.getAttribute(name));
}
function keyframes(svg: string, name: string) {
  const body = svg.split(`@keyframes ${name}{`)[1]?.split('}}')[0] ?? '';
  return Array.from(body.matchAll(/([\d.]+)%\{([^}]+)/g), ([, pct, value]) => ({
    offset: Number(pct) / 100,
    value: value!,
  }));
}

describe('contribution viewport regression', () => {
  it.each([
    { height: '300', rows: '100', columns: '52' },
    { cell_size: '32', columns: '52' },
    { width: '240', rows: '100', columns: '260' },
    { height: '120', rows: '20' },
  ])('rejects unreadable or impossible explicit geometry: %j', (raw) => {
    expect(() => renderChart(model('contributions', raw))).toThrow(
      /(?:width|height|cell_size).*(?:increase|reduce|auto)/i,
    );
  });

  it.each([
    { width: '240', rows: '100', columns: '52', show_y_axis: 'false' },
    { height: '300', rows: '20', columns: '52' },
    { width: '240', columns: '40', rows: '100' },
    { cell_size: '32', columns: '4', cell_gap: '12', cell_radius: '16' },
    {
      width: '240',
      height: '300',
      rows: '10',
      columns: '4',
      title: 'W'.repeat(200),
    },
  ])('fits square cells, grid, dates and logo: %j', (raw) => {
    const m = model('contributions', raw);
    const geo = contribGeometry(m);
    const svg = renderChart(m).svg;
    const root = document(svg).documentElement!;
    const clip = elements(svg, 'clipPath')[0]!.firstChild!;
    const bounds = clip as ReturnType<typeof elements>[number];
    expect(attr(bounds, 'x')).toBeGreaterThanOrEqual(16);
    expect(attr(bounds, 'x') + attr(bounds, 'width')).toBeLessThanOrEqual(
      attr(root, 'width') - 16,
    );
    expect(attr(bounds, 'y') + attr(bounds, 'height')).toBeLessThanOrEqual(
      attr(root, 'height') - 40,
    );
    expect(geo.gridWidth).toBe(geo.cols * geo.cell + (geo.cols - 1) * geo.gap);
    expect(geo.gridHeight).toBe(geo.rows * geo.cell + (geo.rows - 1) * geo.gap);
    for (const rect of elements(withoutLegend(svg), 'rect').filter((el) =>
      el.getAttribute('class')?.match(/^sc-(empty|l[234])$/),
    )) {
      expect(attr(rect, 'width')).toBe(geo.cell);
      expect(attr(rect, 'height')).toBe(geo.cell);
      expect(attr(rect, 'rx')).toBe(geo.radius);
    }
    for (const text of elements(svg, 'text')) {
      expect(attr(text, 'y')).toBeLessThanOrEqual(attr(root, 'height') - 8);
    }
  });
});

describe('temporal slot regressions', () => {
  it.each([1, 2, 13])(
    '%i weeks retain 52 distinct ordered temporal buckets',
    (weeks) => {
      const m = model('line', { columns: '52' }, weeks);
      const frame = buildFrame(m, { axis: true, compact: false });
      expect(new Set(frame.points.map((p) => p.x)).size).toBe(52);
      expect(m.buckets[0]!.startTime).toBe(FIXED_NOW - (weeks - 1) * MS_WEEK);
      expect(m.buckets.at(-1)!.endTime).toBe(FIXED_NOW + MS_WEEK);
      expect(m.buckets.reduce((sum, b) => sum + b.added, 0)).toBe(
        m.windowAdded,
      );
      expect(m.buckets.at(-1)!.cumulative).toBe(m.windowMax);
      const actual = new Set([
        0,
        ...historyFromAdds(Array.from({ length: weeks }, (_, i) => i + 1))
          .cumulative,
      ]);
      m.buckets.forEach((b, i) => {
        expect(b.endTime).toBeGreaterThan(b.startTime);
        expect(actual.has(b.cumulative)).toBe(true);
        if (i) {
          expect(b.startTime).toBe(m.buckets[i - 1]!.endTime);
          expect(frame.points[i]!.x).toBeGreaterThan(frame.points[i - 1]!.x);
        }
      });
    },
  );

  it('retains non-UTC source boundaries and the nominal partial final week', () => {
    const first = FIXED_NOW - MS_WEEK;
    const last = FIXED_NOW + 3_600_000;
    const h = historyFromAdds([3, 7]);
    const history = {
      ...h,
      weeks: [
        {
          ...h.weeks[0]!,
          time: first,
          timestamp: new Date(first).toISOString(),
        },
        { ...h.weeks[1]!, time: last, timestamp: new Date(last).toISOString() },
      ],
    };
    const m = buildChartModel(
      makeConfig({ style: 'line', weeks: '2', columns: '4' }),
      makeMetadata(),
      history,
      { asOf: last + 86400000 },
    );
    expect(m.buckets.map((b) => b.endTime)).toEqual([
      first + (last - first) / 2,
      last,
      last + MS_WEEK / 2,
      last + MS_WEEK,
    ]);
    expect(m.buckets.map((b) => b.cumulative)).toEqual([0, 3, 3, 10]);
    expect(m.buckets.map((b) => b.observations)).toEqual([0, 1, 0, 1]);
    const svg = renderChart(m).svg;
    expect(svg).toContain('final week may still be partial');
    expect(svg).not.toMatch(/d="[^"]*C/); // step interpolation, not intra-week smoothing
  });

  it('zero histories retain temporal slots without synthetic growth', () => {
    const m = buildChartModel(
      makeConfig({ columns: '52', style: 'line' }),
      makeMetadata(),
      historyFromAdds([0]),
      { asOf: FIXED_NOW },
    );
    const frame = buildFrame(m, { axis: true, compact: false });
    expect(new Set(frame.points.map((p) => p.x)).size).toBe(52);
    expect(
      frame.points.every((p) => p.y === frame.baselineY && p.cumulative === 0),
    ).toBe(true);
  });

  it.each([1, 2, 4, 52])(
    '%i bars stay inside the plot, including stroke and gaps',
    (columns) => {
      const m = model('bar', { columns: String(columns) });
      const frame = buildFrame(m, { axis: true, compact: false });
      const bars = elements(withoutLegend(renderChart(m).svg), 'rect').filter(
        (el) => el.getAttribute('class') === 'sc-bar',
      );
      expect(bars).toHaveLength(columns);
      let end = frame.plotLeft;
      for (const bar of bars) {
        expect(attr(bar, 'x')).toBeGreaterThanOrEqual(end);
        end = attr(bar, 'x') + attr(bar, 'width');
        expect(end).toBeLessThanOrEqual(frame.plotLeft + frame.plotWidth);
      }
    },
  );
});

describe('vertical scale regression', () => {
  it.each(['line', 'area', 'bar'] as const)(
    '%s starts at zero by default and can zoom to the window baseline without resetting counts',
    (style) => {
      const history = historyFromAdds([1000, ...Array<number>(13).fill(10)]);
      const expectedCounts = Array.from(
        { length: 13 },
        (_, i) => 1010 + i * 10,
      );
      const frames = ['', 'absolute', 'visible'].map((scale) => {
        const m = buildChartModel(
          makeConfig({ style, scale, period: '3m', columns: '13' }),
          makeMetadata(),
          history,
          { asOf: FIXED_NOW },
        );
        const frame = buildFrame(m, { axis: true, compact: false });
        const svg = renderChart(m).svg;
        const ticks = elements(svg, 'text').filter(
          (el) => el.getAttribute('text-anchor') === 'end',
        );
        expect(checkSvg(svg).errors).toEqual([]);
        expect(m.baseline).toBe(1000);
        expect(m.windowAdded).toBe(130);
        expect(frame.points.map((point) => point.cumulative)).toEqual(
          expectedCounts,
        );
        expect(frame.yMin).toBe(scale === 'visible' ? 1000 : 0);
        expect(ticks.some((tick) => tick.textContent === '0')).toBe(
          scale !== 'visible',
        );
        if (scale !== 'visible') {
          expect(frame.yTicks[0]).toEqual({
            value: 0,
            y: frame.baselineY,
          });
        }
        return frame;
      });
      expect(frames[0]!.points).toEqual(frames[1]!.points);
      expect(frames[2]!.points[0]!.y).toBeGreaterThan(frames[1]!.points[0]!.y);
    },
  );
});

describe('shared animation regression', () => {
  it.each(styles)(
    '%s discrete steps finish by the exact build boundary, not one frame later',
    (style) => {
      for (const animation_style of ['grow', 'reveal', 'cascade']) {
        for (const animation_direction of ['simultaneous', 'chronological']) {
          const svg = renderChart(
            model(style, {
              animation: 'loop',
              animation_style,
              animation_direction,
              animation_easing: 'linear',
            }),
          ).svg;
          const names = Array.from(
            svg.matchAll(/@keyframes ([^{]+)\{/g),
            (m) => m[1]!,
          );
          expect(names.length).toBeGreaterThan(0);
          for (const name of names) {
            const frames = keyframes(svg, name);
            const final = frames.at(-1)!.value.split(';')[0];
            const atBuild = frames.filter((f) => f.offset <= 4 / 6).at(-1)!;
            expect(atBuild.value.split(';')[0]).toBe(final);
            const atHold = frames.filter((f) => f.offset <= 5 / 6).at(-1)!;
            expect(atHold.value.split(';')[0]).toBe(final);
          }
        }
      }
    },
  );

  it.each(styles)(
    '%s total is the actual stars text and finishes at build, not cycle',
    (style) => {
      const svg = renderChart(
        model(style, {
          animation: 'loop',
          animation_delay: '3s',
          animate_total: 'true',
        }),
      ).svg;
      const total = elements(svg, 'text').find((el) =>
        el.getAttribute('class')?.includes(`sc-${style}-total`),
      );
      expect(total?.textContent).toContain('9,007,199,254,740,991');
      const frames = keyframes(svg, `sc-${style}-totalkf`);
      expect(frames[0]).toEqual({ offset: 0, value: 'opacity:0;' });
      expect(
        frames.find((f) => f.value === 'opacity:0;' && f.offset > 0)!.offset *
          6,
      ).toBeCloseTo(3.6, 4);
      expect(
        frames.find((f) => f.value === 'opacity:1;')!.offset * 6,
      ).toBeCloseTo(4, 4);
      expect(frames.at(-1)?.offset).toBe(1);
      expect(svg).toContain(`sc-${style}-totalkf 6s linear 3s infinite both`);
      expect(
        renderChart(
          model(style, {
            animation: 'loop',
            animate_total: 'true',
            show_total: 'false',
          }),
        ).svg,
      ).not.toContain(`sc-${style}-totalkf`);
    },
  );

  it.each(['line', 'area', 'sparkline', 'bar'] as ChartStyle[])(
    '%s build reaches final at 4s and holds to 6s',
    (style) => {
      const svg = renderChart(
        model(style, {
          animation: 'loop',
          animation_style: style === 'bar' ? 'reveal' : 'grow',
          animation_easing: 'linear',
        }),
      ).svg;
      const name =
        style === 'line' || style === 'sparkline'
          ? `sc-${style}-draw`
          : `sc-${style}-wipekf`;
      const frames = keyframes(svg, name);
      expect(frames.some((f) => Math.abs(f.offset * 6 - 4) < 0.0001)).toBe(
        true,
      );
      expect(frames.at(-1)?.value).toBe(
        frames.find((f) => Math.abs(f.offset * 6 - 4) < 0.0001)?.value,
      );
    },
  );

  it('growing bars share initial delay, cycle and overlapping windows', () => {
    for (const direction of ['chronological', 'simultaneous']) {
      const m = model('bar', {
        animation: 'loop',
        animation_delay: '3s',
        animation_direction: direction,
        animation_easing: 'linear',
      });
      const svg = renderChart(m).svg;
      const timeline = resolveTimeline(m.config.animation);
      const windows = m.buckets.map((_, i) =>
        columnWindow(i, 4, m.config.animation, timeline),
      );
      expect(windows[0]!.startFrac).toBe(0);
      expect(windows.at(-1)!.endFrac * 6).toBeCloseTo(4);
      for (let i = 0; i < 4; i++) {
        expect(svg).toContain(`sc-bar-bargrow-${i} 6s linear 3s infinite both`);
        const frames = keyframes(svg, `sc-bar-bargrow-${i}`);
        expect(
          frames.find((f) => f.value.includes('scaleY(1)'))!.offset,
        ).toBeCloseTo(windows[i]!.endFrac, 5);
        if (i)
          expect(windows[i]!.startFrac).toBeLessThan(windows[i - 1]!.endFrac);
      }
    }
  });

  it.each(['line', 'area', 'sparkline', 'bar'] as ChartStyle[])(
    '%s cascade retains discrete timing in its shorthand',
    (style) => {
      const svg = renderChart(
        model(style, {
          animation: 'loop',
          animation_style: 'cascade',
          animation_easing: 'linear',
        }),
      ).svg;
      expect(svg).toMatch(
        new RegExp(`animation:sc-${style}-wipekf 6s steps\\(4,end\\)`),
      );
      const frames = keyframes(svg, `sc-${style}-wipekf`);
      expect(frames[1]!.offset * 6).toBeCloseTo(1, 4);
      expect(frames[1]!.value).toContain(
        'scaleX(0.25);animation-timing-function:steps(1,end)',
      );
      const eased = renderChart(
        model(style, {
          animation: 'loop',
          animation_style: 'cascade',
          animation_easing: 'ease-in',
        }),
      ).svg;
      expect(keyframes(eased, `sc-${style}-wipekf`)[1]!.offset * 6).toBeCloseTo(
        2,
        4,
      );
    },
  );

  it.each(styles)(
    '%s once and static modes retain final-state fallbacks without counters',
    (style) => {
      for (const animation_style of ['grow', 'reveal', 'cascade']) {
        const once = renderChart(
          model(style, {
            animation: 'once',
            animate_total: 'true',
            animation_style,
            animation_delay: '3s',
          }),
        ).svg;
        expect(once).toContain(`sc-${style}-totalkf 4s linear 3s 1 both`);
        expect(once).not.toContain('infinite');
        const css =
          document(once).getElementsByTagName('style')[0]!.textContent!;
        // Every animation declaration lives in an opt-in motion media block.
        expect(
          css.replace(
            /@media \(prefers-reduced-motion:no-preference\)\{(?:[^{}]|\{[^{}]*\})*\}/g,
            '',
          ),
        ).not.toMatch(/animation:/);
        const staticSvg = renderChart(
          model(style, {
            animation: 'none',
            animate_total: 'true',
            animation_style,
          }),
        ).svg;
        expect(staticSvg).not.toContain('@keyframes');
        expect(staticSvg).not.toContain('opacity:0');
        expect(staticSvg).not.toContain('<script');
      }
    },
  );
});

describe('header layout regression', () => {
  it.each(styles)(
    '%s handles large growth, counts and header-free layouts',
    (style) => {
      const m = buildChartModel(
        makeConfig({ style, width: '240', columns: '4', rows: '10' }),
        makeMetadata({ stargazersCount: Number.MAX_SAFE_INTEGER }),
        historyFromAdds([Number.MAX_SAFE_INTEGER]),
        { asOf: FIXED_NOW },
      );
      const svg = renderChart(m).svg;
      const header = elements(svg, 'g').find(
        (el) => el.getAttribute('class') === 'sc-header',
      )!;
      const total = Array.from(header.getElementsByTagName('text')).find((el) =>
        el.getAttribute('class')?.includes('sc-total'),
      )!;
      const change = Array.from(header.getElementsByTagName('text')).find(
        (el) => el.getAttribute('class')?.includes('sc-change'),
      )!;
      expect(attr(change, 'y')).toBeGreaterThan(attr(total, 'y') + 13);
      for (const label of elements(svg, 'text').filter(
        (el) => el.getAttribute('font-size') === '10',
      )) {
        const x = attr(label, 'x');
        const width = attr(label, 'textLength');
        const anchor = label.getAttribute('text-anchor');
        const left =
          x - (anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0);
        expect(left).toBeGreaterThanOrEqual(16 - 1e-6);
        expect(left + width).toBeLessThanOrEqual(224 + 1e-6);
      }
      const hidden = model(style, {
        show_title: 'false',
        show_total: 'false',
        show_change: 'false',
        animation: 'loop',
        animate_total: 'true',
      });
      expect(renderChart(hidden).svg).not.toContain('class="sc-header"');
      expect(renderChart(hidden).svg).not.toContain('totalkf');
    },
  );

  for (const style of styles) {
    it.each([
      { width: '240' },
      { title: 'W'.repeat(200) },
      {
        width: '240',
        title: 'W'.repeat(200),
        font_family: 'Courier New, monospace',
      },
      {
        width: '240',
        font_family: `${'Long Custom Font '.repeat(10)}, monospace`,
      },
      { width: '240', show_title: 'false' },
      { width: '240', show_total: 'false' },
      { width: '240', show_change: 'false' },
      { width: '240', show_total: 'false', show_change: 'false' },
    ])(
      `${style} bounds text independently of custom font metrics: %j`,
      (raw) => {
        const svg = renderChart(model(style, raw)).svg;
        const width = Number(raw.width ?? 900);
        const header = elements(svg, 'g').find(
          (el) => el.getAttribute('class') === 'sc-header',
        );
        expect(header).toBeDefined();
        const boxes = Array.from(header!.getElementsByTagName('text')).map(
          (el) => {
            const length = attr(el, 'textLength');
            expect(length).toBeGreaterThan(0);
            const x =
              attr(el, 'x') -
              (el.getAttribute('text-anchor') === 'end' ? length : 0);
            return {
              x,
              y: attr(el, 'y'),
              width: length,
              height: attr(el, 'font-size'),
            };
          },
        );
        for (const [i, a] of boxes.entries()) {
          expect(a.x).toBeGreaterThanOrEqual(16);
          expect(a.x + a.width).toBeLessThanOrEqual(width - 16);
          for (const b of boxes.slice(i + 1)) {
            expect(
              a.x + a.width <= b.x ||
                b.x + b.width <= a.x ||
                a.y <= b.y - b.height ||
                b.y <= a.y - a.height,
            ).toBe(true);
          }
        }
        if (raw.title)
          expect(
            document(svg).getElementsByTagName('title')[0]!.textContent,
          ).toBe(raw.title);
      },
    );
  }
});

describe('axis legend sizing', () => {
  const axisLabels = (svg: string, size: number) =>
    elements(svg, 'text').filter((el) => attr(el, 'font-size') === size);

  const svgBox = (svg: string) => {
    const root = elements(svg, 'svg')[0]!;
    return { width: attr(root, 'width'), height: attr(root, 'height') };
  };

  it.each(styles)('%s: defaults to a 10px legend', (style) => {
    const svg = renderChart(model(style)).svg;
    expect(axisLabels(svg, DEFAULT_AXIS_FONT_SIZE).length).toBeGreaterThan(0);
    expect(svg).toBe(
      renderChart(
        model(style, { axis_font_size: String(DEFAULT_AXIS_FONT_SIZE) }),
      ).svg,
    );
  });

  it.each(styles)('%s: scales axis text and its reserved band', (style) => {
    const base = renderChart(model(style)).svg;
    const big = renderChart(model(style, { axis_font_size: '24' })).svg;
    const check = checkSvg(big);
    expect(check.errors).toEqual([]);

    const labels = axisLabels(big, 24);
    expect(labels).toHaveLength(
      axisLabels(base, DEFAULT_AXIS_FONT_SIZE).length,
    );
    expect(axisLabels(big, DEFAULT_AXIS_FONT_SIZE)).toHaveLength(0);

    const { width, height } = svgBox(big);
    if (style === 'contributions') {
      // A wider gutter can shrink square cells, even as label bands grow.
      expect(
        legendHeight(model(style, { axis_font_size: '24' })),
      ).toBeGreaterThan(legendHeight(model(style)));
    } else expect(height).toBeGreaterThan(svgBox(base).height);

    for (const label of labels) {
      const length = attr(label, 'textLength');
      expect(length).toBeGreaterThan(0);
      const anchor = label.getAttribute('text-anchor');
      const left =
        attr(label, 'x') -
        (anchor === 'end' ? length : anchor === 'middle' ? length / 2 : 0);
      expect(left).toBeGreaterThanOrEqual(16 - 1e-6);
      expect(left + length).toBeLessThanOrEqual(width - 16 + 1e-6);
      expect(attr(label, 'y')).toBeLessThanOrEqual(height);
    }
  });

  it.each(['line', 'area', 'bar'] as ChartStyle[])(
    '%s: widens the y-axis gutter with the legend',
    (style) => {
      const opts = { axis: true, compact: false };
      const base = buildFrame(model(style), opts);
      const big = buildFrame(model(style, { axis_font_size: '20' }), opts);
      expect(base.axisFontSize).toBe(DEFAULT_AXIS_FONT_SIZE);
      expect(big.axisFontSize).toBe(20);
      expect(big.plotLeft).toBeGreaterThan(base.plotLeft);
      expect(big.plotWidth).toBeLessThan(base.plotWidth);
    },
  );

  it('keeps the reserved band at 8px when dates are hidden', () => {
    const hidden = model('contributions', {
      show_dates: 'false',
      axis_font_size: '24',
    });
    const shown = model('contributions', { show_dates: 'false' });
    expect(datesHeight(hidden)).toBe(8);
    expect(datesHeight(shown)).toBe(8);
  });
});

describe('programmatic config without block dimensions', () => {
  const history = historyFromAdds(Array.from({ length: 60 }, (_, i) => i + 1));

  /** Drops `columns`/`rows`, as an untyped JS caller easily would. */
  function stripDimensions<T extends object>(
    value: T,
  ): Omit<T, 'columns' | 'rows'> {
    const clone = { ...value } as Record<string, unknown>;
    delete clone.columns;
    delete clone.rows;
    return clone as Omit<T, 'columns' | 'rows'>;
  }

  /** Mimics a `dist/lib.js` caller that never went through parseInputs. */
  function partialConfig(style: ChartStyle): ChartConfigInput {
    return stripDimensions(makeConfig({ style, weeks: '60' }));
  }

  it.each(styles)('%s defaults to 52 columns and 26 rows', (style) => {
    const config = partialConfig(style);
    expect(config).not.toHaveProperty('columns');
    expect(config).not.toHaveProperty('rows');

    const built = buildChartModel(config, makeMetadata(), history, {
      asOf: FIXED_NOW,
    });
    expect(built.config.columns).toBe(DEFAULT_COLUMNS);
    expect(built.config.rows).toBe(DEFAULT_ROWS);
    expect(built.buckets).toHaveLength(DEFAULT_COLUMNS);

    const svg = renderChart(built).svg;
    expect(checkSvg(svg).errors).toEqual([]);
    const marks =
      elements(svg, 'rect').length +
      elements(svg, 'path').length +
      elements(svg, 'polyline').length;
    expect(marks).toBeGreaterThan(0);
  });

  it('renders contributions when a model carries a partial config', () => {
    const built = buildChartModel(
      makeConfig({ style: 'contributions', weeks: '60' }),
      makeMetadata(),
      history,
      { asOf: FIXED_NOW },
    );
    const partial = { ...built, config: stripDimensions(built.config) };

    expect(contribGeometry(partial).rows).toBe(DEFAULT_ROWS);
    expect(columnHeight(partial, built.windowMax)).toBe(DEFAULT_ROWS);

    const svg = renderChart(partial).svg;
    expect(checkSvg(svg).errors).toEqual([]);
    expect(elements(svg, 'rect').length).toBeGreaterThan(DEFAULT_COLUMNS);
  });

  it('renderStarChart accepts a config without block dimensions', () => {
    const svg = renderStarChart(
      partialConfig('line'),
      makeMetadata(),
      history,
      FIXED_NOW,
    );
    expect(checkSvg(svg).errors).toEqual([]);
    expect(elements(svg, 'path').length).toBeGreaterThan(0);
  });

  it('defaults the axis font size when a caller omits it', () => {
    const clone = { ...partialConfig('line') } as Record<string, unknown>;
    delete clone.axisFontSize;
    const config = clone as ChartConfigInput;
    expect(config).not.toHaveProperty('axisFontSize');

    const built = buildChartModel(config, makeMetadata(), history, {
      asOf: FIXED_NOW,
    });
    expect(built.config.axisFontSize).toBe(DEFAULT_AXIS_FONT_SIZE);

    const svg = renderChart(built).svg;
    expect(checkSvg(svg).errors).toEqual([]);
    expect(svg).toContain(`font-size="${DEFAULT_AXIS_FONT_SIZE}"`);
  });

  it('keeps explicitly supplied dimensions untouched', () => {
    const built = buildChartModel(
      makeConfig({ style: 'contributions', columns: '8', rows: '5' }),
      makeMetadata(),
      history,
      { asOf: FIXED_NOW },
    );
    expect(built.config.columns).toBe(8);
    expect(built.config.rows).toBe(5);
    expect(built.buckets).toHaveLength(8);
  });
});
