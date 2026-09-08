/**
 * Pure aggregation helpers for multi-repository charts.
 *
 * Aggregation is a sum, not a comparison: several repositories collapse into a
 * single history and a single synthetic metadata record, which the rest of the
 * pipeline then treats exactly like one repository.
 */

import type {
  NormalizedHistory,
  RepositoryMetadata,
  WeekPoint,
} from '../models/index.js';
import { MS_PER_WEEK, utcWeekStart } from '../utils/dates.js';

/**
 * Sums normalized histories into one.
 *
 * Source weeks are keyed by their UTC calendar week so repositories whose API
 * week boundaries differ still line up. Within a key the additions are summed
 * and the earliest contributing source timestamp is preserved, which keeps
 * ordering deterministic and monotonic (offsets always fall inside the keyed
 * week). Gaps between keys are filled with synthetic zero weeks, and a week is
 * only flagged synthetic when no repository recorded real data for it.
 * Cumulative values are recomputed from the summed additions.
 */
export function aggregateHistories(
  histories: readonly NormalizedHistory[],
): NormalizedHistory {
  if (histories.length === 0) {
    return {
      weeks: [],
      cumulative: [],
      hasSyntheticWeeks: false,
      totalAdded: 0,
    };
  }
  const single = histories[0];
  if (histories.length === 1 && single) {
    return single;
  }

  interface Slot {
    key: number;
    time: number;
    timestamp: string;
    added: number;
    synthetic: boolean;
  }

  const slots = new Map<number, Slot>();
  let hasSynthetic = false;

  for (const history of histories) {
    if (history.hasSyntheticWeeks) {
      hasSynthetic = true;
    }
    for (const week of history.weeks) {
      const key = utcWeekStart(week.time);
      const existing = slots.get(key);
      if (!existing) {
        slots.set(key, {
          key,
          time: week.time,
          timestamp: week.timestamp,
          added: week.added,
          synthetic: week.synthetic,
        });
        continue;
      }
      existing.added += week.added;
      // A slot is synthetic only when every contributor is synthetic.
      existing.synthetic = existing.synthetic && week.synthetic;
      if (
        week.time < existing.time ||
        (week.time === existing.time && week.timestamp < existing.timestamp)
      ) {
        existing.time = week.time;
        existing.timestamp = week.timestamp;
      }
    }
  }

  const ordered = [...slots.values()].sort((a, b) => a.key - b.key);
  const weeks: WeekPoint[] = [];
  let previousKey: number | null = null;

  for (const slot of ordered) {
    if (previousKey !== null) {
      for (
        let gap = previousKey + MS_PER_WEEK;
        gap < slot.key;
        gap += MS_PER_WEEK
      ) {
        hasSynthetic = true;
        weeks.push({
          timestamp: new Date(gap).toISOString(),
          time: gap,
          added: 0,
          synthetic: true,
        });
      }
    }
    if (slot.synthetic) {
      hasSynthetic = true;
    }
    weeks.push({
      timestamp: slot.timestamp,
      time: slot.time,
      added: slot.added,
      synthetic: slot.synthetic,
    });
    previousKey = slot.key;
  }

  const cumulative: number[] = [];
  let running = 0;
  for (const week of weeks) {
    running += week.added;
    cumulative.push(running);
  }

  return {
    weeks,
    cumulative,
    hasSyntheticWeeks: hasSynthetic,
    totalAdded: running,
  };
}

/**
 * Collapses repository metadata into a single aggregate record: summed stars,
 * the earliest creation time, and a compact display name.
 */
export function aggregateMetadata(
  entries: readonly RepositoryMetadata[],
): RepositoryMetadata {
  const first = entries[0];
  if (!first) {
    throw new Error('At least one repository is required to aggregate.');
  }
  if (entries.length === 1) {
    return first;
  }

  let stargazersCount = 0;
  let createdAt = first.createdAt;
  let createdAtTime = Date.parse(first.createdAt);
  for (const entry of entries) {
    stargazersCount += entry.stargazersCount;
    const time = Date.parse(entry.createdAt);
    if (
      Number.isFinite(time) &&
      (!Number.isFinite(createdAtTime) || time < createdAtTime)
    ) {
      createdAtTime = time;
      createdAt = entry.createdAt;
    }
  }

  return {
    owner: first.owner,
    repo: first.repo,
    fullName: aggregateDisplayName(entries),
    createdAt,
    stargazersCount,
  };
}

/**
 * Builds the aggregate display name: two repositories are joined in full, and
 * longer lists are summarised so header titles stay legible.
 */
export function aggregateDisplayName(
  entries: readonly RepositoryMetadata[],
): string {
  const first = entries[0];
  if (!first) {
    return '';
  }
  if (entries.length === 1) {
    return first.fullName;
  }
  if (entries.length === 2) {
    const second = entries[1];
    return `${first.fullName} + ${second ? second.fullName : ''}`;
  }
  return `${first.fullName} + ${entries.length - 1} more repositories`;
}
