import type { NormalizedHistory, WeekPoint } from '../models/index.js';
import { MS_PER_WEEK, utcWeekStart } from '../utils/dates.js';
import { HistoryError } from './normalize.js';

/**
 * Places recorded additions on a creation-to-now UTC weekly spine. Missing
 * coverage within a repository's lifetime is unknown, not evidence of zero
 * growth; only slots before its creation are known zero (for comparisons).
 */
export function creationHistory(
  history: NormalizedHistory,
  createdAt: string,
  asOf: number,
  rangeStart = Date.parse(createdAt),
): NormalizedHistory {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created) || !Number.isFinite(asOf) || created > asOf) {
    throw new HistoryError(`Invalid repository creation range: ${createdAt}.`);
  }
  const first = utcWeekStart(created);
  const last = utcWeekStart(asOf);
  const byWeek = new Map<number, { added: number; synthetic: boolean }>();
  for (const week of history.weeks) {
    const key = utcWeekStart(week.time);
    if (key < first || key > last) continue;
    const previous = byWeek.get(key);
    byWeek.set(key, {
      added: (previous?.added ?? 0) + week.added,
      synthetic: previous
        ? previous.synthetic && week.synthetic
        : week.synthetic,
    });
  }
  const weeks: WeekPoint[] = [];
  const cumulative: number[] = [];
  let running = 0;
  for (let key = utcWeekStart(rangeStart); key <= last; key += MS_PER_WEEK) {
    const observation = byWeek.get(key);
    const time = Math.max(rangeStart, key);
    const added = observation?.added ?? 0;
    running += added;
    weeks.push({
      time,
      timestamp: new Date(time).toISOString(),
      added,
      synthetic: observation?.synthetic ?? key >= first,
    });
    cumulative.push(running);
  }
  return {
    weeks,
    cumulative,
    totalAdded: running,
    hasSyntheticWeeks:
      history.hasSyntheticWeeks || weeks.some((week) => week.synthetic),
  };
}
