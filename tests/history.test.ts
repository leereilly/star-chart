import { describe, it, expect } from 'vitest';
import { normalizeHistory, HistoryError } from '../src/history/normalize.js';
import { selectWindow } from '../src/history/window.js';
import { bucketWindow } from '../src/history/bucket.js';
import { buildChartModel } from '../src/history/model.js';
import {
  aggregateDisplayName,
  aggregateHistories,
  aggregateMetadata,
} from '../src/history/aggregate.js';
import { utcWeekStart } from '../src/utils/dates.js';
import type { RawWeek } from '../src/api/history.js';
import type { NormalizedHistory } from '../src/models/index.js';
import {
  FIXED_NOW,
  MS_WEEK,
  historyFromAdds,
  makeConfig,
  makeMetadata,
  rawWeeksFromAdds,
} from './helpers/index.js';

describe('normalizeHistory', () => {
  it('sorts, sums cumulative, preserves timestamps', () => {
    const raw = rawWeeksFromAdds([1, 2, 3]).reverse();
    const h = normalizeHistory(raw, { asOf: FIXED_NOW });
    expect(h.weeks.map((w) => w.added)).toEqual([1, 2, 3]);
    expect(h.cumulative).toEqual([1, 3, 6]);
    expect(h.totalAdded).toBe(6);
    expect(h.hasSyntheticWeeks).toBe(false);
  });

  it('rejects days that do not sum to total', () => {
    const raw: RawWeek[] = [
      {
        timestamp: new Date(FIXED_NOW).toISOString(),
        total: 5,
        days: [1, 1, 1, 1, 0, 0, 0],
      },
    ];
    expect(() => normalizeHistory(raw, { asOf: FIXED_NOW })).toThrow(
      HistoryError,
    );
  });

  it('rejects wrong day-length', () => {
    const raw: RawWeek[] = [
      {
        timestamp: new Date(FIXED_NOW).toISOString(),
        total: 0,
        days: [0, 0, 0],
      },
    ];
    expect(() => normalizeHistory(raw, { asOf: FIXED_NOW })).toThrow(
      HistoryError,
    );
  });

  it('deduplicates identical weeks but fails on conflicts', () => {
    const ts = new Date(FIXED_NOW).toISOString();
    const identical: RawWeek[] = [
      { timestamp: ts, total: 2, days: [2, 0, 0, 0, 0, 0, 0] },
      { timestamp: ts, total: 2, days: [2, 0, 0, 0, 0, 0, 0] },
    ];
    const h = normalizeHistory(identical, { asOf: FIXED_NOW });
    expect(h.weeks).toHaveLength(1);

    const conflict: RawWeek[] = [
      { timestamp: ts, total: 2, days: [2, 0, 0, 0, 0, 0, 0] },
      { timestamp: ts, total: 3, days: [3, 0, 0, 0, 0, 0, 0] },
    ];
    expect(() => normalizeHistory(conflict, { asOf: FIXED_NOW })).toThrow(
      HistoryError,
    );
  });

  it('fills internal gaps with synthetic zero weeks + flag', () => {
    const t0 = FIXED_NOW - 4 * MS_WEEK;
    const raw: RawWeek[] = [
      {
        timestamp: new Date(t0).toISOString(),
        total: 1,
        days: [1, 0, 0, 0, 0, 0, 0],
      },
      {
        timestamp: new Date(t0 + 3 * MS_WEEK).toISOString(),
        total: 2,
        days: [2, 0, 0, 0, 0, 0, 0],
      },
    ];
    const warnings: string[] = [];
    const h = normalizeHistory(raw, {
      asOf: FIXED_NOW,
      warn: (m) => warnings.push(m),
    });
    expect(h.weeks).toHaveLength(4);
    expect(h.weeks[1]?.synthetic).toBe(true);
    expect(h.weeks[2]?.synthetic).toBe(true);
    expect(h.cumulative).toEqual([1, 1, 1, 3]);
    expect(h.hasSyntheticWeeks).toBe(true);
    expect(warnings.join(' ')).toMatch(/coverage/);
  });

  it('tolerates DST-shifted timestamps as single week steps', () => {
    // Two weeks 7 days apart but with a 1-hour civil shift.
    const t0 = Date.UTC(2026, 2, 1, 0, 0, 0);
    const raw: RawWeek[] = [
      {
        timestamp: new Date(t0).toISOString(),
        total: 1,
        days: [1, 0, 0, 0, 0, 0, 0],
      },
      {
        timestamp: new Date(t0 + MS_WEEK + 3_600_000).toISOString(),
        total: 1,
        days: [1, 0, 0, 0, 0, 0, 0],
      },
    ];
    const h = normalizeHistory(raw, { asOf: FIXED_NOW });
    expect(h.weeks).toHaveLength(2);
    expect(h.hasSyntheticWeeks).toBe(false);
  });

  it('rejects future observations', () => {
    const raw: RawWeek[] = [
      {
        timestamp: new Date(FIXED_NOW + 5 * MS_WEEK).toISOString(),
        total: 0,
        days: [0, 0, 0, 0, 0, 0, 0],
      },
    ];
    expect(() => normalizeHistory(raw, { asOf: FIXED_NOW })).toThrow(
      HistoryError,
    );
  });

  it('handles empty history', () => {
    const h = normalizeHistory([], { asOf: FIXED_NOW });
    expect(h.weeks).toHaveLength(0);
    expect(h.totalAdded).toBe(0);
  });
});

describe('selectWindow baseline (computed before trimming)', () => {
  it('baseline is cumulative just before the window', () => {
    const history = historyFromAdds([1, 1, 1, 1, 1, 1]); // cumulative 1..6
    const config = makeConfig({ weeks: '2' });
    const w = selectWindow(history, config);
    expect(w.weeks).toHaveLength(2);
    expect(w.baseline).toBe(4); // cumulative before last 2 weeks
    expect(w.windowAdded).toBe(2);
    expect(w.cumulative).toEqual([5, 6]);
  });

  it('baseline is zero when window covers all history', () => {
    const history = historyFromAdds([2, 3]);
    const w = selectWindow(history, makeConfig({ weeks: '10' }));
    expect(w.baseline).toBe(0);
    expect(w.windowAdded).toBe(5);
  });
});

describe('bucketWindow aggregation', () => {
  it('conserves totals and end cumulative', () => {
    const history = historyFromAdds([1, 2, 3, 4]); // cumulative 1,3,6,10
    const w = selectWindow(history, makeConfig({ weeks: '4' }));
    const buckets = bucketWindow(w, 2, w.baseline);
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.added).toBe(3); // weeks 1+2
    expect(buckets[1]?.added).toBe(7); // weeks 3+4
    expect(buckets[1]?.cumulative).toBe(10);
    expect(buckets.reduce((s, b) => s + b.added, 0)).toBe(10);
  });

  it('carries cumulative forward when columns exceed observations', () => {
    const history = historyFromAdds([5, 5]); // cumulative 5,10
    const w = selectWindow(history, makeConfig({ weeks: '2' }));
    const buckets = bucketWindow(w, 4, w.baseline);
    expect(buckets).toHaveLength(4);
    // No fabricated intra-week growth; cumulative is monotonic non-decreasing.
    const cums = buckets.map((b) => b.cumulative);
    for (let i = 1; i < cums.length; i += 1) {
      expect(cums[i]!).toBeGreaterThanOrEqual(cums[i - 1]!);
    }
    expect(cums[cums.length - 1]).toBe(10);
    expect(buckets.reduce((s, b) => s + b.added, 0)).toBe(10);
  });

  it('produces flat baseline buckets for empty windows', () => {
    const w = selectWindow(historyFromAdds([]), makeConfig());
    const buckets = bucketWindow(w, 5, 0);
    expect(buckets).toHaveLength(5);
    expect(buckets.every((b) => b.added === 0)).toBe(true);
  });
});

describe('buildChartModel', () => {
  it('computes window max, dates, and empty flag', () => {
    const history = historyFromAdds([0, 0, 0]);
    const model = buildChartModel(makeConfig(), makeMetadata(), history, {
      asOf: FIXED_NOW,
    });
    expect(model.isEmpty).toBe(true);
    expect(model.windowAdded).toBe(0);
    expect(model.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(model.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('current stars can differ from cumulative additions', () => {
    const history = historyFromAdds([1, 1, 1]); // total 3
    const model = buildChartModel(
      makeConfig(),
      makeMetadata({ stargazersCount: 999 }),
      history,
      { asOf: FIXED_NOW },
    );
    expect(model.currentStars).toBe(999);
    expect(model.windowAdded).toBe(3);
  });
});

describe('peak gain', () => {
  it('reports the largest source week, not the largest bucket', () => {
    // 12 weeks with a single 9-star spike, aggregated into 3 display buckets:
    // each bucket merges four weeks, so the bucket totals exceed the spike.
    const adds = [3, 3, 3, 3, 3, 9, 3, 3, 3, 3, 3, 3];
    const history = historyFromAdds(adds);
    const model = buildChartModel(
      makeConfig({ columns: '3' }),
      makeMetadata(),
      history,
      { asOf: FIXED_NOW },
    );
    const maxBucket = Math.max(...model.buckets.map((b) => b.added));
    expect(maxBucket).toBeGreaterThan(9);
    expect(model.peakGain).toBe(9);
    expect(model.selectedWeeks.map((w) => w.added)).toEqual(adds);
  });

  it('is zero for an empty history', () => {
    const model = buildChartModel(
      makeConfig(),
      makeMetadata(),
      historyFromAdds([]),
      { asOf: FIXED_NOW },
    );
    expect(model.peakGain).toBe(0);
    expect(model.selectedWeeks).toEqual([]);
  });

  it('only considers weeks inside the selected window', () => {
    const history = historyFromAdds([50, 1, 2, 3]);
    const model = buildChartModel(
      makeConfig({ weeks: '3' }),
      makeMetadata(),
      history,
      { asOf: FIXED_NOW },
    );
    expect(model.peakGain).toBe(3);
    expect(model.baseline).toBe(50);
  });
});

describe('aggregateHistories', () => {
  it('returns the single history untouched', () => {
    const history = historyFromAdds([1, 2, 3]);
    expect(aggregateHistories([history])).toBe(history);
    expect(aggregateHistories([]).weeks).toEqual([]);
  });

  it('sums aligned calendar weeks and recomputes cumulative values', () => {
    const a = historyFromAdds([1, 2, 3]);
    const b = historyFromAdds([10, 20, 30]);
    const merged = aggregateHistories([a, b]);
    expect(merged.weeks.map((w) => w.added)).toEqual([11, 22, 33]);
    expect(merged.cumulative).toEqual([11, 33, 66]);
    expect(merged.totalAdded).toBe(66);
    expect(merged.hasSyntheticWeeks).toBe(false);
  });

  it('aligns weeks whose timestamps differ within the same calendar week', () => {
    // Second repository reports its week two days later; both belong to the
    // same UTC calendar week and must merge into one slot.
    const a = historyFromAdds([5, 5]);
    const b = historyFromAdds([7, 7], FIXED_NOW + 2 * 86_400_000);
    const merged = aggregateHistories([a, b]);
    expect(merged.weeks).toHaveLength(2);
    expect(merged.weeks.map((w) => w.added)).toEqual([12, 12]);
    // The earliest contributing timestamp is preserved.
    expect(merged.weeks[1]?.timestamp).toBe(a.weeks[1]?.timestamp);
  });

  it('unions partially overlapping ranges and fills the non-overlap', () => {
    const older = historyFromAdds([1, 1, 1, 1], FIXED_NOW - 2 * MS_WEEK);
    const newer = historyFromAdds([5, 5, 5], FIXED_NOW);
    const merged = aggregateHistories([older, newer]);
    // Weeks -5..-3 come from `older` only, -2 overlaps, -1..0 from `newer`.
    expect(merged.weeks.map((w) => w.added)).toEqual([1, 1, 1, 6, 5, 5]);
    expect(merged.cumulative).toEqual([1, 2, 3, 9, 14, 19]);
    expect(merged.totalAdded).toBe(19);
  });

  it('fills gaps between calendar weeks with synthetic zero weeks', () => {
    const a = historyFromAdds([4], FIXED_NOW - 4 * MS_WEEK);
    const b = historyFromAdds([6], FIXED_NOW);
    const merged = aggregateHistories([a, b]);
    expect(merged.weeks.map((w) => w.added)).toEqual([4, 0, 0, 0, 6]);
    expect(merged.weeks.map((w) => w.synthetic)).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
    expect(merged.hasSyntheticWeeks).toBe(true);
    expect(merged.weeks.map((w) => w.time)).toEqual(
      [...merged.weeks].map((w) => w.time).sort((x, y) => x - y),
    );
  });

  it('keeps a week real when any repository recorded it', () => {
    const real = historyFromAdds([0, 3]);
    const syntheticSource: NormalizedHistory = {
      ...historyFromAdds([0, 0]),
      hasSyntheticWeeks: true,
      weeks: historyFromAdds([0, 0]).weeks.map((w) => ({
        ...w,
        synthetic: true,
      })),
    };
    const merged = aggregateHistories([syntheticSource, real]);
    expect(merged.weeks.map((w) => w.synthetic)).toEqual([false, false]);
    // A source-level gap is still surfaced.
    expect(merged.hasSyntheticWeeks).toBe(true);
  });

  it('is deterministic regardless of input order', () => {
    const a = historyFromAdds([1, 2, 3], FIXED_NOW - MS_WEEK);
    const b = historyFromAdds([4, 5], FIXED_NOW);
    expect(aggregateHistories([a, b])).toEqual(aggregateHistories([b, a]));
  });
});

describe('aggregateMetadata', () => {
  it('sums stars, keeps the earliest creation, and names the aggregate', () => {
    const first = makeMetadata({
      fullName: 'octo/one',
      stargazersCount: 100,
      createdAt: new Date(FIXED_NOW - 10 * MS_WEEK).toISOString(),
    });
    const second = makeMetadata({
      fullName: 'octo/two',
      stargazersCount: 40,
      createdAt: new Date(FIXED_NOW - 90 * MS_WEEK).toISOString(),
    });
    const merged = aggregateMetadata([first, second]);
    expect(merged.stargazersCount).toBe(140);
    expect(merged.createdAt).toBe(second.createdAt);
    expect(merged.fullName).toBe('octo/one + octo/two');
  });

  it('summarises longer lists', () => {
    const entries = ['a/one', 'a/two', 'a/three'].map((fullName) =>
      makeMetadata({ fullName, stargazersCount: 1 }),
    );
    expect(aggregateMetadata(entries).fullName).toBe(
      'a/one + 2 more repositories',
    );
    expect(aggregateDisplayName(entries.slice(0, 1))).toBe('a/one');
  });

  it('passes a single repository through unchanged', () => {
    const only = makeMetadata();
    expect(aggregateMetadata([only])).toBe(only);
    expect(() => aggregateMetadata([])).toThrow();
  });
});

describe('utcWeekStart', () => {
  it('floors to Sunday 00:00 UTC', () => {
    const wednesday = Date.UTC(2026, 8, 2, 13, 45);
    expect(utcWeekStart(wednesday)).toBe(Date.UTC(2026, 7, 30));
    const sunday = Date.UTC(2026, 7, 30);
    expect(utcWeekStart(sunday)).toBe(sunday);
    expect(utcWeekStart(sunday + MS_WEEK - 1)).toBe(sunday);
  });
});
