import { describe, expect, it } from 'vitest';
import {
  buildMultiRepositoryChartModel,
  normalizeHistory,
  normalizeChartModel,
  renderMultiRepositoryStarChart,
} from '../src/lib.js';
import { buildChartModel } from '../src/history/model.js';
import { renderChart } from '../src/renderers/index.js';
import { buildFrame } from '../src/renderers/conventional.js';
import {
  aggregateHistories,
  aggregateMetadata,
} from '../src/history/aggregate.js';
import type {
  ChartStyle,
  RepositoryHistorySource,
} from '../src/models/index.js';
import {
  checkSvg,
  FIXED_NOW,
  historyFromAdds,
  makeConfig,
  makeMetadata,
  MS_WEEK,
  withoutLegend,
} from './helpers/index.js';

export const NEW_STYLES: ChartStyle[] = [
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

function model(
  style: ChartStyle,
  adds = [1, 2, 0, 10, 5, 60, 0, 2],
  extra: Record<string, string> = {},
) {
  return buildChartModel(
    makeConfig({ style, columns: '8', rows: '10', ...extra }),
    makeMetadata(),
    historyFromAdds(adds),
    { asOf: FIXED_NOW },
  );
}

describe('new chart styles', () => {
  for (const style of NEW_STYLES) {
    it(`${style}: supports default resolution and custom palette`, () => {
      const cfg = makeConfig({
        style,
        theme: 'auto',
        level_4_color: '#123abc',
      });
      const m = buildChartModel(
        cfg,
        makeMetadata(),
        historyFromAdds([1, 2, 3]),
        { asOf: FIXED_NOW },
      );
      expect(checkSvg(renderChart(m).svg).errors).toEqual([]);
      expect(renderChart(m).svg).toContain('#123abc');
    });
    it(`${style}: valid deterministic geometry across themes and edge cases`, () => {
      for (const theme of ['light', 'dark', 'auto']) {
        for (const adds of [
          [],
          [5],
          [0, 0, 0],
          [100, 0, 0],
          [1, 0, 100000, 1],
        ]) {
          const m = model(style, adds, { theme, title: '<chart>&"' });
          const { svg } = renderChart(m);
          expect(checkSvg(svg).errors).toEqual([]);
          expect(svg).toBe(renderChart(m).svg);
          expect(svg).toContain('&lt;chart&gt;&amp;');
        }
      }
    });
    it(`${style}: shared reveal respects all animation options`, () => {
      for (const mode of ['once', 'loop']) {
        for (const animationStyle of ['grow', 'reveal', 'cascade']) {
          for (const direction of ['chronological', 'simultaneous']) {
            const svg = renderChart(
              model(style, undefined, {
                animation: mode,
                animation_style: animationStyle,
                animation_direction: direction,
                animate_total: 'true',
              }),
            ).svg;
            expect(checkSvg(svg).errors).toEqual([]);
            expect(svg).toContain('prefers-reduced-motion:no-preference');
            expect(svg).toContain('@keyframes');
          }
        }
      }
    });
  }

  it('step-line uses staircase segments even with dense data', () => {
    const svg = renderChart(model('step-line')).svg;
    const path = svg.match(/data-chart="step-line"[^>]*d="([^"]+)"/)?.[1];
    expect(path).toBeDefined();
    expect(path).not.toMatch(/[CQ]/);
    expect(path?.split('L').length).toBeGreaterThan(8);
  });

  it('grid uses square tiles with one intensity per cumulative column', () => {
    const svg = withoutLegend(renderChart(model('grid')).svg);
    expect(svg).toContain('data-chart="grid"');
    expect(svg).toContain('data-column="7"');
    const cells = [
      ...svg.matchAll(
        /<rect class="sc-l\d"[^>]*width="([^"]+)" height="([^"]+)"/g,
      ),
    ];
    expect(cells.length).toBeGreaterThan(8);
    expect(cells.every((m) => m[1] === m[2])).toBe(true);
    expect(svg).toContain('text-anchor="end"');
  });

  it('grid honours explicit tile dimensions and visible baseline scaling', () => {
    const m = model('grid', [1000, 1, 1, 1], {
      weeks: '3',
      columns: '3',
      rows: '10',
      cell_size: '10',
      cell_gap: '2',
      cell_radius: '3',
      width: '360',
      height: '280',
    });
    const absolute = withoutLegend(renderChart(m).svg);
    const visible = withoutLegend(
      renderChart({
        ...m,
        config: { ...m.config, scale: 'visible' },
      }).svg,
    );
    expect(absolute).toContain('width="10" height="10" rx="3"');
    expect(absolute.match(/<rect class="sc-l/g)?.length).toBeGreaterThan(
      visible.match(/<rect class="sc-l/g)?.length ?? 0,
    );
    expect(absolute).not.toContain('Infinity');
  });

  it('neon preserves sparse staircase growth and keeps halo bounds local', () => {
    const m = model('neon-glow', [1, 10], { animation: 'once' });
    const svg = renderChart(m).svg;
    expect(svg.match(/data-chart="neon-glow" d="([^"]+)"/)?.[1]).not.toMatch(
      /[CQ]/,
    );
    expect(svg).toContain('filterUnits="userSpaceOnUse"');
    const f = buildFrame(m, { axis: true, compact: false, inset: 12 });
    expect(f.plotLeft - 12).toBeGreaterThanOrEqual(0);
    expect(f.plotLeft + f.plotWidth + 12).toBeLessThanOrEqual(f.width);
    expect(f.plotTop - 12).toBeGreaterThanOrEqual(0);
    expect(f.baselineY + 12).toBeLessThanOrEqual(f.height);
  });

  it('milestones use actual source endpoints even in merged display buckets', () => {
    const m = model('milestone-scatter', [1, 1, 1000, 0, 0, 0, 0, 0], {
      columns: '2',
    });
    const svg = renderChart(m).svg;
    expect(svg).toContain('data-observed="1002"');
    expect(svg).toContain(`data-time="${FIXED_NOW - 4 * MS_WEEK}"`);
    expect(svg).toContain('crossed');
    expect(svg).not.toContain('data-chart="milestone-area-fill"');
    const area = renderChart({
      ...m,
      config: { ...m.config, style: 'milestone-area' },
    }).svg;
    expect(area).toContain('data-chart="milestone-area-fill"');
  });

  it('neon styles have local halos; only stream has a gradient area', () => {
    const line = renderChart(model('neon-glow')).svg;
    const stream = renderChart(model('neon-glow-stream')).svg;
    expect(line).toContain('<feGaussianBlur');
    expect(stream).toContain('<linearGradient');
    expect(line).not.toContain('<linearGradient');
    expect(stream).toContain('data-chart="neon-glow-stream-fill"');
  });

  it('terminal renders preserved monospaced glyph rows rather than bars', () => {
    const svg = renderChart(model('ascii-terminal')).svg;
    expect(svg).toContain('xml:space="preserve"');
    expect(svg).toContain('font-family="monospace"');
    expect(svg).toContain('#');
    expect(svg).toContain('+--------+');
    expect(svg).not.toContain('<rect class="sc-bar"');
  });

  it('hand-drawn has deterministic double strokes and hatched area', () => {
    const svg = renderChart(model('hand-drawn')).svg;
    expect(svg).toContain('<pattern');
    expect(svg).toContain('data-chart="sketch-secondary"');
    expect(svg).toContain('data-chart="sketch-primary"');
    const sparse = renderChart(model('hand-drawn', [1, 2])).svg;
    expect(
      sparse.match(/data-chart="sketch-primary" d="([^"]+)"/)?.[1],
    ).not.toBe(sparse.match(/data-chart="sketch-secondary" d="([^"]+)"/)?.[1]);
  });

  it('rejects impossible tile, terminal and cluster geometry clearly', () => {
    for (const style of [
      'grid',
      'ascii-terminal',
      'clustered-bar',
    ] as ChartStyle[]) {
      expect(() =>
        renderChart(
          model(style, undefined, {
            width: '240',
            columns: '200',
            rows: '100',
          }),
        ),
      ).toThrow(/fit|columns|resolution/i);
    }
  });
});

describe('aligned repository comparisons', () => {
  const sources: RepositoryHistorySource[] = [
    {
      metadata: makeMetadata(),
      history: historyFromAdds([100, 2, 3, 4, 5, 6]),
    },
    {
      metadata: makeMetadata({
        repo: 'new',
        fullName: 'octocat/new',
        createdAt: new Date(FIXED_NOW - 2 * MS_WEEK).toISOString(),
      }),
      history: historyFromAdds([10, 20], FIXED_NOW - MS_WEEK + 3600000),
    },
  ];
  it('preserves original single-source slots even when timestamp offsets share a calendar week', () => {
    const history = normalizeHistory(
      [
        {
          timestamp: '2026-08-23T00:00:00Z',
          total: 10,
          days: [10, 0, 0, 0, 0, 0, 0],
        },
        {
          timestamp: '2026-08-27T00:00:00Z',
          total: 20,
          days: [20, 0, 0, 0, 0, 0, 0],
        },
      ],
      { asOf: FIXED_NOW },
    );
    const m = buildMultiRepositoryChartModel(
      makeConfig({ columns: '8' }),
      [{ metadata: makeMetadata(), history }],
      { asOf: FIXED_NOW },
    );
    expect(m.series?.[0]?.buckets).toEqual(m.buckets);
    expect(m.series?.[0]?.windowMax).toBe(30);
    expect(
      normalizeChartModel({ ...m, config: { ...m.config, rows: null } }).series,
    ).toBe(m.series);
  });
  for (const columns of ['2', '12']) {
    it(`aligns different starts, ends and offsets before selecting ${columns} buckets`, () => {
      const cfg = makeConfig({ style: 'clustered-bar', weeks: '3', columns });
      const m = buildMultiRepositoryChartModel(cfg, sources, {
        asOf: FIXED_NOW,
      });
      const aggregate = buildChartModel(
        cfg,
        aggregateMetadata(sources.map((s) => s.metadata)),
        aggregateHistories(sources.map((s) => s.history)),
        { asOf: FIXED_NOW },
      );
      expect(m.buckets).toEqual(aggregate.buckets);
      expect(m.series?.map((s) => s.baseline)).toEqual([105, 0]);
      expect(m.series?.[1]?.hasSyntheticWeeks).toBe(false);
      for (const [i, bucket] of m.buckets.entries()) {
        expect(
          m.series?.reduce(
            (sum, s) => sum + (s.buckets[i]?.cumulative ?? 0),
            0,
          ),
        ).toBe(bucket.cumulative);
        expect(
          m.series?.reduce((sum, s) => sum + (s.buckets[i]?.added ?? 0), 0),
        ).toBe(bucket.added);
        for (const s of m.series ?? []) {
          expect(s.buckets[i]?.startTime).toBe(bucket.startTime);
          expect(s.buckets[i]?.endTime).toBe(bucket.endTime);
        }
      }
      expect(
        checkSvg(renderMultiRepositoryStarChart(cfg, sources, FIXED_NOW))
          .errors,
      ).toEqual([]);
    });
  }
  it('scales clustered bars by individual series, with zero or lowest baseline', () => {
    const m = buildMultiRepositoryChartModel(
      makeConfig({ style: 'clustered-bar', columns: '3', weeks: '2' }),
      sources,
      { asOf: FIXED_NOW },
    );
    const f = buildFrame(m, {
      axis: true,
      compact: false,
      centered: true,
      series: m.series,
    });
    expect(f.yMin).toBe(0);
    expect(f.yMax).toBe(120);
    const v = buildFrame(
      { ...m, config: { ...m.config, scale: 'visible' } },
      { axis: true, compact: false, centered: true, series: m.series },
    );
    expect(v.yMin).toBe(10);
    const svg = renderChart(m).svg;
    expect(svg.match(/data-repository=/g)).toHaveLength(6);
    expect(svg).toContain('octocat/new');
  });
  it('does not invent series from already aggregated data', () => {
    const m = model('clustered-bar', undefined, {
      repositories: 'a/one,a/two',
    });
    expect(() => renderChart(m)).toThrow(/series|repository histor/i);
  });
  it('escapes comparison labels and supports many repositories without color reuse', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      metadata: makeMetadata({ fullName: `owner/project-${index}<&"` }),
      history: historyFromAdds([index, index + 1]),
    }));
    const m = buildMultiRepositoryChartModel(
      makeConfig({ style: 'clustered-bar', columns: '2' }),
      many,
      { asOf: FIXED_NOW },
    );
    const svg = renderChart(m).svg;
    expect(checkSvg(svg).errors).toEqual([]);
    expect(svg.match(/data-repository=/g)).toHaveLength(40);
    expect(svg).toContain('&lt;&amp;&quot;');
    expect(
      new Set([...svg.matchAll(/fill:(hsl\([^)]+\))/g)].map((m) => m[1])).size,
    ).toBe(20);
  });
  it('rejects misaligned and incomplete comparison series', () => {
    const m = buildMultiRepositoryChartModel(
      makeConfig({
        style: 'clustered-bar',
        repositories: 'a/one,a/two',
        columns: '3',
      }),
      sources,
      { asOf: FIXED_NOW },
    );
    expect(() =>
      renderChart({ ...m, series: (m.series ?? []).slice(0, 1) }),
    ).toThrow(/series/);
    expect(() =>
      renderChart({
        ...m,
        series: (m.series ?? []).map((s) => ({
          ...s,
          buckets: s.buckets.slice(1),
        })),
      }),
    ).toThrow(/boundaries/);
  });
  it('handles empty sources and gaps without inventing additions', () => {
    expect(() =>
      buildMultiRepositoryChartModel(makeConfig(), [], { asOf: FIXED_NOW }),
    ).toThrow(/repository/i);
    const missing = historyFromAdds([5, 0, 2]);
    const gapped = {
      ...missing,
      weeks: missing.weeks.filter((_, i) => i !== 1),
      cumulative: [5, 7],
    };
    const m = buildMultiRepositoryChartModel(
      makeConfig({ style: 'clustered-bar', columns: '6' }),
      [
        { metadata: makeMetadata(), history: gapped },
        {
          metadata: makeMetadata({ fullName: 'empty/repo' }),
          history: historyFromAdds([]),
        },
      ],
      { asOf: FIXED_NOW },
    );
    expect(m.hasSyntheticWeeks).toBe(true);
    expect(m.series?.[1]?.buckets.every((b) => b.cumulative === 0)).toBe(true);
    expect(checkSvg(renderChart(m).svg).errors).toEqual([]);
  });
});
