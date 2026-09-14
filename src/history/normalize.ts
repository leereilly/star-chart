import type { NormalizedHistory, WeekPoint } from '../models/index.js';
import { MS_PER_WEEK, weekStepsBetween } from '../utils/dates.js';
import type { RawWeek } from '../api/history.js';

export interface NormalizeOptions {
  /** Injected clock (epoch ms); observations after this are rejected. */
  readonly asOf: number;
  readonly warn?: (message: string) => void;
}

export class HistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoryError';
  }
}

/**
 * Validates, sorts, de-duplicates, and gap-fills raw weekly history, then
 * computes cumulative additions.
 *
 * Timestamps are preserved exactly (not UTC-floored). Internal gaps are filled
 * with synthetic zero weeks and flagged; interrupted pagination is the
 * fetcher's concern, not this function's.
 */
export function normalizeHistory(
  raw: readonly RawWeek[],
  options: NormalizeOptions,
): NormalizedHistory {
  const warn = options.warn ?? ((): void => undefined);
  const validated = raw.map((week) => validateWeek(week, options.asOf));

  // Sort ascending (oldest first).
  validated.sort((a, b) => a.time - b.time);

  // Deduplicate; conflicting duplicates fail.
  const deduped: InternalWeek[] = [];
  for (const week of validated) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.time === week.time) {
      if (
        previous.total !== week.total ||
        !sameDays(previous.days, week.days)
      ) {
        throw new HistoryError(
          `Conflicting duplicate week at ${week.timestamp}.`,
        );
      }
      continue; // identical duplicate; skip
    }
    deduped.push(week);
  }

  if (deduped.length === 0) {
    return {
      weeks: [],
      cumulative: [],
      hasSyntheticWeeks: false,
      totalAdded: 0,
    };
  }

  // Fill internal gaps using seven-day steps from the first observed anchor.
  const filled: WeekPoint[] = [];
  let hasSynthetic = false;
  const anchor = deduped[0];
  if (!anchor) {
    throw new HistoryError('Unexpected empty history after validation.');
  }

  for (let i = 0; i < deduped.length; i += 1) {
    const current = deduped[i];
    if (!current) {
      continue;
    }
    if (i > 0) {
      const previous = deduped[i - 1];
      if (previous) {
        const steps = weekStepsBetween(previous.time, current.time);
        if (steps <= 0) {
          throw new HistoryError(
            `Non-increasing week timestamps near ${current.timestamp}.`,
          );
        }
        for (let gap = 1; gap < steps; gap += 1) {
          hasSynthetic = true;
          const syntheticTime = previous.time + gap * MS_PER_WEEK;
          filled.push({
            timestamp: new Date(syntheticTime).toISOString(),
            time: syntheticTime,
            added: 0,
            synthetic: true,
          });
        }
      }
    }
    filled.push({
      timestamp: current.timestamp,
      time: current.time,
      added: current.total,
      synthetic: false,
    });
  }

  if (hasSynthetic) {
    warn(
      'Star history has internal coverage gaps; missing weeks were filled ' +
        'with zero additions.',
    );
  }

  // Cumulative prefix sums over the full history.
  const cumulative: number[] = [];
  let running = 0;
  for (const week of filled) {
    running += week.added;
    cumulative.push(running);
  }

  return {
    weeks: filled,
    cumulative,
    hasSyntheticWeeks: hasSynthetic,
    totalAdded: running,
  };
}

interface InternalWeek {
  timestamp: string;
  time: number;
  total: number;
  days: readonly number[];
}

function validateWeek(week: RawWeek, asOf: number): InternalWeek {
  const time = Date.parse(week.timestamp);
  if (!Number.isFinite(time)) {
    throw new HistoryError(`Invalid week timestamp: ${week.timestamp}`);
  }
  if (time > asOf + MS_PER_WEEK) {
    throw new HistoryError(
      `Week timestamp ${week.timestamp} is in the future.`,
    );
  }
  if (!Number.isSafeInteger(week.total) || week.total < 0) {
    throw new HistoryError(
      `Invalid weekly total at ${week.timestamp}: ${String(week.total)}`,
    );
  }
  if (week.days.length !== 7) {
    throw new HistoryError(
      `Week ${week.timestamp} must have exactly 7 daily values.`,
    );
  }
  let daySum = 0;
  for (const day of week.days) {
    if (!Number.isSafeInteger(day) || day < 0) {
      throw new HistoryError(
        `Invalid daily value at ${week.timestamp}: ${String(day)}`,
      );
    }
    daySum += day;
  }
  if (daySum !== week.total) {
    throw new HistoryError(
      `Week ${week.timestamp} daily sum (${daySum}) != total (${week.total}).`,
    );
  }
  return {
    timestamp: week.timestamp,
    time,
    total: week.total,
    days: week.days,
  };
}

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}
