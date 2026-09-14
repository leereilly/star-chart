import { describe, expect, it } from 'vitest';
import { buildChartModel } from '../src/history/model.js';
import { buildMultiRepositoryChartModel } from '../src/history/multi.js';
import { HistoryError } from '../src/history/normalize.js';
import { buildFrame } from '../src/renderers/conventional.js';
import { renderChart } from '../src/renderers/index.js';
import { checkSvg } from './helpers/index.js';
import {
  FIXED_NOW,
  MS_WEEK,
  historyFromAdds,
  makeConfig,
  makeMetadata,
} from './helpers/index.js';

const created = FIXED_NOW - 120 * MS_WEEK + 2 * 86400000;
const metadata = makeMetadata({ createdAt: new Date(created).toISOString() });
const history = historyFromAdds([3, 7], FIXED_NOW - 2 * MS_WEEK);

describe('creation-to-now timeline', () => {
  it.each([{}, { period: 'all' }])(
    'extends recorded coverage for %j',
    (raw) => {
      const model = buildChartModel(makeConfig(raw), metadata, history, {
        asOf: FIXED_NOW,
      });
      expect(model.periodStart).toBe(metadata.createdAt.slice(0, 10));
      expect(model.periodEnd).toBe('2026-09-06');
      expect(model.selectedWeeks.length).toBeGreaterThan(52);
      expect(model.selectedWeeks[0]?.time).toBe(created);
      expect(model.selectedWeeks[0]?.synthetic).toBe(true);
      expect(model.selectedWeeks.at(-1)?.time).toBe(FIXED_NOW);
      expect(model.selectedWeeks.at(-1)?.synthetic).toBe(true);
      expect(model.buckets[0]?.startTime).toBe(created);
      expect(model.buckets.at(-1)?.endTime).toBe(FIXED_NOW);
      expect(model.buckets[0]?.cumulative).toBe(0);
      expect(model.buckets.at(-1)?.cumulative).toBe(10);
      expect(model.baseline).toBe(0);
      expect(model.windowMax).toBe(10);
      expect(model.windowAdded).toBe(10);
      expect(model.hasSyntheticWeeks).toBe(true);
      expect(new Set(model.buckets.map((b) => b.startTime)).size).toBe(52);
    },
  );

  it.each([
    'line',
    'area',
    'bar',
    'sparkline',
    'milestone-scatter',
    'milestone-area',
  ])(
    '%s displays creation on the axis and keeps data inside the current boundary',
    (style) => {
      const model = buildChartModel(
        makeConfig({ style, date_format: 'iso' }),
        metadata,
        history,
        { asOf: FIXED_NOW },
      );
      const frame = buildFrame(model, { axis: true, compact: false });
      expect(frame.xForTime(created)).toBe(frame.plotLeft);
      expect(frame.xForTime(FIXED_NOW)).toBe(frame.plotLeft + frame.plotWidth);
      expect(frame.points[0]!.x).toBeGreaterThan(frame.plotLeft);
      expect(frame.points.every((p) => p.time <= FIXED_NOW)).toBe(true);
      const svg = renderChart(model).svg;
      expect(checkSvg(svg).ok).toBe(true);
      expect(svg.match(/<g class="sc-dates">.*?<\/g>/)?.[0]).toContain(
        '2024-05-21',
      );
    },
  );

  it('keeps all history even beyond the explicit weeks input cap', () => {
    const start = FIXED_NOW - 3100 * MS_WEEK;
    const model = buildChartModel(
      makeConfig(),
      makeMetadata({ createdAt: new Date(start).toISOString() }),
      historyFromAdds([2]),
      { asOf: FIXED_NOW },
    );
    expect(model.selectedWeeks).toHaveLength(3101);
    expect(model.buckets[0]?.startTime).toBe(start);
  });

  it('retains more than a year of additions unless an explicit range overrides it', () => {
    const recorded = historyFromAdds(Array.from({ length: 120 }, () => 1));
    for (const raw of [{}, { weeks: '52' }, { period: '1y' }]) {
      const model = buildChartModel(makeConfig(raw), metadata, recorded, {
        asOf: FIXED_NOW,
      });
      const explicit = 'weeks' in raw || 'period' in raw;
      expect(model.windowAdded).toBe(explicit ? 52 : 120);
      expect(model.baseline).toBe(explicit ? 68 : 0);
      expect(model.buckets.at(-1)?.cumulative).toBe(120);
    }
  });

  it('clips a partial current UTC week without extrapolating its recorded total', () => {
    const asOf = FIXED_NOW + 3.5 * 86400000;
    const birth = FIXED_NOW - MS_WEEK + 2.5 * 86400000;
    const model = buildChartModel(
      makeConfig(),
      makeMetadata({ createdAt: new Date(birth).toISOString() }),
      historyFromAdds([2, 3], FIXED_NOW + 86400000),
      { asOf },
    );
    expect(model.selectedWeeks.map((w) => w.time)).toEqual([birth, FIXED_NOW]);
    expect(model.buckets[0]?.startTime).toBe(birth);
    expect(model.buckets.at(-1)?.endTime).toBe(asOf);
    expect(model.periodEnd).toBe('2026-09-09');
    expect(model.windowAdded).toBe(5);
    expect(model.hasSyntheticWeeks).toBe(false);
  });

  it.each([{ weeks: '1' }, { period: '3m' }])(
    'preserves explicit trailing windows %j',
    (raw) => {
      const model = buildChartModel(makeConfig(raw), metadata, history, {
        asOf: FIXED_NOW,
      });
      expect(model.selectedWeeks).toHaveLength(raw.weeks ? 1 : 2);
      expect(model.baseline).toBe(raw.weeks ? 3 : 0);
      expect(model.periodEnd).toBe('2026-08-23');
      expect(model.hasSyntheticWeeks).toBe(false);
    },
  );

  it.each([{ adds: [] }, { adds: [1] }])(
    'gives sparse history %j a real date axis',
    ({ adds }) => {
      const model = buildChartModel(
        makeConfig(),
        metadata,
        historyFromAdds(adds),
        { asOf: FIXED_NOW },
      );
      expect(model.buckets[0]?.startTime).toBe(created);
      expect(model.buckets.at(-1)?.endTime).toBe(FIXED_NOW);
      expect(model.windowAdded).toBe(adds.length);
      expect(model.isEmpty).toBe(adds.length === 0);
      expect(model.hasSyntheticWeeks).toBe(true);
    },
  );

  it('includes the creation calendar week but excludes older and future weeks', () => {
    const birth = FIXED_NOW - MS_WEEK + 3 * 86400000;
    const model = buildChartModel(
      makeConfig(),
      makeMetadata({ createdAt: new Date(birth).toISOString() }),
      historyFromAdds([100, 2, 3, 200], FIXED_NOW + MS_WEEK),
      { asOf: FIXED_NOW },
    );
    expect(model.selectedWeeks.map((w) => w.added)).toEqual([2, 3]);
    expect(model.selectedWeeks[0]?.time).toBe(birth);
    expect(model.windowAdded).toBe(5);
    expect(model.hasSyntheticWeeks).toBe(false);
    expect(model.buckets.at(-1)?.endTime).toBe(FIXED_NOW);
  });

  it('handles creation at the injected clock without invalid geometry', () => {
    const model = buildChartModel(
      makeConfig(),
      makeMetadata({ createdAt: new Date(FIXED_NOW).toISOString() }),
      historyFromAdds([1]),
      { asOf: FIXED_NOW },
    );
    expect(model.periodStart).toBe(model.periodEnd);
    expect(model.windowAdded).toBe(1);
    expect(model.buckets.every((b) => Number.isFinite(b.endTime))).toBe(true);
  });

  it.each(['invalid', new Date(FIXED_NOW + MS_WEEK).toISOString()])(
    'rejects invalid creation ranges: %s',
    (createdAt) => {
      expect(() =>
        buildChartModel(makeConfig(), makeMetadata({ createdAt }), history, {
          asOf: FIXED_NOW,
        }),
      ).toThrow(HistoryError);
    },
  );

  it('aligns independent series from the oldest nonfirst repository', () => {
    const young = makeMetadata({
      repo: 'young',
      fullName: 'octocat/young',
      createdAt: new Date(FIXED_NOW - MS_WEEK).toISOString(),
    });
    const model = buildMultiRepositoryChartModel(
      makeConfig({ style: 'clustered-bar', scale: 'visible' }),
      [
        { metadata: young, history: historyFromAdds([1, 2]) },
        { metadata, history },
      ],
      { asOf: FIXED_NOW },
    );
    expect(model.periodStart).toBe(metadata.createdAt.slice(0, 10));
    expect(model.windowAdded).toBe(13);
    for (const series of model.series!) {
      expect(series.selectedWeeks.map((w) => w.time)).toEqual(
        model.selectedWeeks.map((w) => w.time),
      );
      expect(series.buckets.map((b) => [b.startTime, b.endTime])).toEqual(
        model.buckets.map((b) => [b.startTime, b.endTime]),
      );
      expect(series.baseline).toBe(0);
    }
    expect(model.series?.[0]?.hasSyntheticWeeks).toBe(false);
    expect(model.series?.[1]?.hasSyntheticWeeks).toBe(true);
    expect(model.hasSyntheticWeeks).toBe(true);
  });
});
