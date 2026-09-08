import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { parseInputs } from '../src/config/inputs.js';
import { normalizeChartConfig } from '../src/config/defaults.js';
import { buildChartModel } from '../src/history/model.js';
import { buildMultiRepositoryChartModel } from '../src/lib.js';
import { buildFrame } from '../src/renderers/conventional.js';
import { contribGeometry } from '../src/renderers/contributions.js';
import { renderChart } from '../src/renderers/index.js';
import type { ChartStyle } from '../src/models/index.js';
import {
  checkSvg,
  FIXED_NOW,
  historyFromAdds,
  makeConfig,
  makeMetadata,
} from './helpers/index.js';

const styles: ChartStyle[] = [
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
const document = (svg: string) =>
  new DOMParser().parseFromString(svg, 'image/svg+xml');
const group = (svg: string, className: string) =>
  Array.from(document(svg).getElementsByTagName('g')).find(
    (element) => element.getAttribute('class') === className,
  )!;
function model(
  style: ChartStyle,
  raw: Record<string, string> = {},
  adds = [1, 2, 4, 9],
) {
  return buildChartModel(
    makeConfig({ style, columns: '4', rows: '8', ...raw }),
    makeMetadata(),
    historyFromAdds(adds),
    { asOf: FIXED_NOW },
  );
}

describe('independent axes and legends', () => {
  it.each(styles)('%s resolves defaults and legacy omitted flags', (style) => {
    const cfg = makeConfig({ style });
    const { showXAxis, showYAxis, showLegend, ...legacy } = cfg;
    expect({ showXAxis, showYAxis, showLegend }).toEqual({
      showXAxis: true,
      showYAxis: style !== 'sparkline',
      showLegend: style !== 'sparkline',
    });
    expect(normalizeChartConfig(legacy)).toEqual(cfg);
    expect(normalizeChartConfig(cfg)).toBe(cfg);
  });
  it.each(['show_x_axis', 'show_y_axis', 'show_legend'])(
    'validates %s',
    (flag) => {
      expect(() =>
        parseInputs({ repository: 'a/b', [flag]: 'maybe' }),
      ).toThrow();
      for (const value of ['true', 'false']) {
        const config = makeConfig({ style: 'sparkline', [flag]: value });
        const key = {
          show_x_axis: 'showXAxis',
          show_y_axis: 'showYAxis',
          show_legend: 'showLegend',
        }[flag]!;
        expect(config[key as keyof typeof config]).toBe(value === 'true');
      }
    },
  );
  it.each(styles)(
    '%s renders every axis/legend combination independently',
    (style) => {
      for (const x of [false, true])
        for (const y of [false, true])
          for (const legend of [false, true]) {
            const svg = renderChart(
              model(style, {
                show_x_axis: String(x),
                show_y_axis: String(y),
                show_legend: String(legend),
                animation: 'once',
              }),
            ).svg;
            expect(checkSvg(svg).errors).toEqual([]);
            expect(svg.includes('class="sc-x-axis"')).toBe(x);
            expect(svg.includes('class="sc-y-axis"')).toBe(y);
            expect(svg.includes('class="sc-dates"')).toBe(x);
            expect(svg.includes('class="sc-legend"')).toBe(legend);
          }
    },
  );
  it('retains the x baseline without dates and reclaims hidden legend space', () => {
    const visible = renderChart(model('line', { show_dates: 'false' })).svg;
    const hidden = renderChart(
      model('line', { show_legend: 'false', show_dates: 'false' }),
    ).svg;
    expect(visible).toContain('class="sc-x-axis"');
    expect(visible).not.toContain('class="sc-dates"');
    const height = (svg: string) =>
      Number(svg.match(/<svg[^>]* height="([^"]+)"/)?.[1]);
    expect(height(visible)).toBeGreaterThan(height(hidden));
  });
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])('aligns small ASCII axes independently (x=%s, y=%s)', (x, y) => {
    const m = model(
      'ascii-terminal',
      {
        rows: '4',
        animation: 'none',
        show_x_axis: String(x),
        show_y_axis: String(y),
      },
      [1, 3, 4, 8],
    );
    const frame = buildFrame(m, {
      axis: true,
      compact: false,
      centered: true,
    });
    const baseline = frame.plotTop + (frame.plotHeight * 4) / (4 + Number(x));
    const svg = renderChart(m).svg;
    const doc = document(svg);
    const terminal = Array.from(doc.getElementsByTagName('text')).find(
      (text) => text.getAttribute('data-chart') === 'ascii-terminal',
    )!;
    const rows = Array.from(terminal.getElementsByTagName('tspan'));
    expect(checkSvg(svg).errors).toEqual([]);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.textContent?.startsWith('|') === y)).toBe(
      true,
    );
    expect(group(svg, 'sc-x-axis') !== undefined).toBe(x);
    expect(group(svg, 'sc-y-axis') !== undefined).toBe(y);
    const borders = Array.from(doc.getElementsByTagName('tspan')).filter(
      (row) => row.textContent?.includes('----'),
    );
    expect(borders).toHaveLength(Number(x));
    if (x) {
      const axis = group(svg, 'sc-x-axis');
      expect(axis.getElementsByTagName('line')).toHaveLength(0);
      expect(axis.getElementsByTagName('path')).toHaveLength(0);
      expect(axis.getElementsByTagName('tspan')[0]).toBeDefined();
      expect(Number(borders[0]!.getAttribute('y'))).toBeCloseTo(baseline, 3);
      expect(borders[0]!.getAttribute('dominant-baseline')).toBe('middle');
      expect(borders[0]!.textContent).toBe(y ? '+----+' : '----');
    }
    if (y) {
      const axis = group(svg, 'sc-y-axis');
      const [vertical, zeroGridline] = Array.from(
        axis.getElementsByTagName('line'),
      );
      expect(Number(vertical!.getAttribute('y2'))).toBeCloseTo(baseline, 3);
      expect(Number(zeroGridline!.getAttribute('y1'))).toBeCloseTo(baseline, 3);
      const zeroLabel = axis.getElementsByTagName('text')[0]!;
      expect(zeroLabel.getAttribute('aria-label')).toBe('0 recorded stars');
      expect(
        Number(zeroLabel.getAttribute('y')) - m.config.axisFontSize * 0.3,
      ).toBeCloseTo(baseline, 3);
    }
  });
  it('describes contribution shading, not weekdays or value bins', () => {
    const svg = renderChart(model('contributions')).svg;
    expect(svg).toContain('Recorded stars');
    expect(svg).toContain('Column tip');
    expect(svg).toContain('Below tip');
    expect(svg).toContain('Unoccupied');
    expect(svg).not.toMatch(/Monday|Wednesday|Friday/);
  });
  it('uses matching cumulative intensity bins in the grid legend', () => {
    const svg = renderChart(model('grid', {}, [1, 3, 4, 8])).svg;
    for (const label of ['(0, 4]', '(4, 8]', '(8, 12]', '(12, 16]'])
      expect(svg).toContain(label);
    expect(svg).toContain('Unoccupied');
  });
  it('aligns contribution count ticks to quantized tile tops and the real baseline', () => {
    const m = model(
      'contributions',
      { scale: 'visible', weeks: '3', rows: '8' },
      [100, 4, 4, 8],
    );
    const svg = renderChart(m).svg;
    const geo = contribGeometry(m);
    const clip = document(svg)
      .getElementsByTagName('clipPath')[0]!
      .getElementsByTagName('rect')[0]!;
    const top = Number(clip.getAttribute('y'));
    const ticks = Array.from(
      group(svg, 'sc-y-axis').getElementsByTagName('text'),
    );
    expect(ticks.map((tick) => tick.getAttribute('aria-label'))).toEqual([
      '100 recorded stars',
      '104 recorded stars',
      '108 recorded stars',
      '112 recorded stars',
      '116 recorded stars',
    ]);
    ticks.forEach((tick, i) => {
      const expected =
        i === 0 ? top + geo.gridHeight : top + (8 - i * 2) * geo.pitch;
      expect(
        Number(tick.getAttribute('y')) - m.config.axisFontSize * 0.3,
      ).toBeCloseTo(expected, 3);
    });
  });
  it('uses visible-scale grid thresholds and the same palette classes as its data', () => {
    const m = model(
      'grid',
      { scale: 'visible', weeks: '4' },
      [100, 1, 3, 4, 8],
    );
    const svg = renderChart(m).svg;
    const legend = group(svg, 'sc-legend');
    expect(
      Array.from(legend.getElementsByTagName('text')).map((t) => t.textContent),
    ).toEqual([
      'Recorded stars',
      '(100, 104]',
      '(104, 108]',
      '(108, 112]',
      '(112, 116]',
      'Unoccupied',
    ]);
    const columns = Array.from(document(svg).getElementsByTagName('g')).filter(
      (g) => g.hasAttribute('data-column'),
    );
    expect(
      columns.map((column) =>
        column.getElementsByTagName('rect')[0]!.getAttribute('class'),
      ),
    ).toEqual(['sc-l1', 'sc-l1', 'sc-l2', 'sc-l4']);
    expect(
      Array.from(legend.getElementsByTagName('rect')).map((r) =>
        r.getAttribute('class'),
      ),
    ).toEqual(['sc-l4', 'sc-l1', 'sc-l2', 'sc-l3', 'sc-l4', 'sc-empty']);
  });
  it.each(styles)(
    '%s distinguishes combined data from independent comparison series',
    (style) => {
      const sources = [
        { metadata: makeMetadata(), history: historyFromAdds([1, 2, 3]) },
        {
          metadata: makeMetadata({ repo: 'other', fullName: 'octocat/other' }),
          history: historyFromAdds([10, 20, 30]),
        },
      ];
      const m = buildMultiRepositoryChartModel(
        makeConfig({
          style,
          repositories: 'octocat/hello-world,octocat/other',
          columns: '3',
          rows: '6',
          show_legend: 'true',
        }),
        sources,
        { asOf: FIXED_NOW },
      );
      const svg = renderChart(m).svg;
      const legend = group(svg, 'sc-legend');
      const labels = Array.from(legend.getElementsByTagName('text')).map(
        (t) => t.textContent,
      );
      if (style === 'clustered-bar') {
        expect(labels).toEqual(['octocat/hello-world', 'octocat/other']);
        const classes = Array.from(legend.getElementsByTagName('rect')).map(
          (r) => r.getAttribute('class'),
        );
        const bars = Array.from(
          document(svg).getElementsByTagName('rect'),
        ).filter((r) => r.hasAttribute('data-repository'));
        expect(bars.slice(0, 2).map((r) => r.getAttribute('class'))).toEqual(
          classes,
        );
      } else {
        expect(labels[0]).toBe('Combined recorded stars');
        expect(labels).not.toContain('octocat/other');
      }
    },
  );
  it('reclaims the Y gutter and legend band without changing the data domain', () => {
    const shown = buildFrame(model('line'), { axis: true, compact: false });
    const hidden = buildFrame(
      model('line', { show_y_axis: 'false', show_legend: 'false' }),
      { axis: true, compact: false },
    );
    expect(hidden.plotLeft).toBe(16);
    expect(hidden.plotWidth).toBeGreaterThan(shown.plotWidth);
    expect(hidden.plotTop).toBeLessThan(shown.plotTop);
    expect([hidden.yMin, hidden.yMax]).toEqual([shown.yMin, shown.yMax]);
  });
  it.each(styles)(
    '%s retains distinct tick values in narrow visible ranges',
    (style) => {
      const svg = renderChart(
        model(
          style,
          {
            scale: 'visible',
            weeks: '3',
            show_y_axis: 'true',
          },
          [10000, 0, 0, 1],
        ),
      ).svg;
      const labels = Array.from(
        group(svg, 'sc-y-axis').getElementsByTagName('text'),
      ).map((t) => t.textContent);
      expect(labels.length).toBeGreaterThan(0);
      expect(new Set(labels).size).toBe(labels.length);
    },
  );
  it.each(styles)(
    '%s supports minimum dimensions with modest resolution and no header',
    (style) => {
      const svg = renderChart(
        model(style, {
          width: '240',
          height: '120',
          columns: '4',
          rows: '4',
          axis_font_size: '6',
          show_title: 'false',
          show_total: 'false',
          show_change: 'false',
          logo: 'false',
          show_x_axis: 'true',
          show_y_axis: 'true',
          show_legend: 'true',
        }),
      ).svg;
      expect(checkSvg(svg).errors).toEqual([]);
    },
  );
  it('wraps large legends, preserves escaped full names and stays outside animation clips', () => {
    const m = model('clustered-bar', {
      width: '360',
      height: '640',
      axis_font_size: '48',
      show_y_axis: 'false',
      animation: 'loop',
    });
    const svg = renderChart({
      ...m,
      metadata: { ...m.metadata, fullName: 'long/<&"'.repeat(20) },
    }).svg;
    const legend = group(svg, 'sc-legend');
    expect(legend.getElementsByTagName('title')[0]!.textContent).toBe(
      'long/<&"'.repeat(20),
    );
    const label = legend.getElementsByTagName('text')[0]!;
    expect(label.textContent).toContain('…');
    expect(
      Number(label.getAttribute('x')) +
        Number(label.getAttribute('textLength')),
    ).toBeLessThanOrEqual(344);
    expect(label.getAttribute('font-size')).toBe('48');
    expect(svg).toContain('&lt;&amp;');
    expect(legend.parentNode?.nodeName).toBe('svg');
    expect(legend.hasAttribute('clip-path')).toBe(false);
  });
  it.each(styles)(
    '%s supports empty, flat, narrow and enlarged-label layouts',
    (style) => {
      for (const adds of [[], [0], [10], [10, 0, 0]]) {
        const svg = renderChart(
          model(
            style,
            {
              width: '360',
              height: '640',
              axis_font_size: '24',
              title: 'Long title '.repeat(15),
            },
            adds,
          ),
        ).svg;
        expect(checkSvg(svg).errors).toEqual([]);
        if (style !== 'sparkline') expect(svg).toContain('class="sc-legend"');
      }
    },
  );
});
