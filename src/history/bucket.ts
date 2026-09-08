import type { Bucket, WindowSelection } from '../models/index.js';
import { MS_PER_WEEK } from '../utils/dates.js';

/**
 * Aggregates the selected weekly window into `columns` display buckets using
 * monotone integer partition boundaries `floor(j*N/K)`.
 *
 * Each bucket keeps the summed additions and the cumulative value at its end.
 * When there are more columns than observations (`K > N`), empty buckets carry
 * the previous cumulative value forward; no intra-week growth is fabricated.
 */
export function bucketWindow(
  window: WindowSelection,
  columns: number,
  baseline: number,
): Bucket[] {
  if (columns < 1) {
    throw new Error('columns must be >= 1');
  }
  const weeks = window.weeks;
  const cumulative = window.cumulative;
  const n = weeks.length;

  if (n === 0) {
    // Empty window: emit flat baseline buckets so the grid renders as zero.
    return emptyBuckets(columns, baseline);
  }

  const buckets: Bucket[] = [];
  let previousCumulative = baseline;
  // Subdivide actual week intervals, not repeated observation timestamps.
  // The final interval remains the nominal API week (possibly still partial).
  const boundaryTime = (position: number): number => {
    const index = Math.min(Math.floor(position), n - 1);
    const anchor = weeks[index];
    if (!anchor) throw new Error(`Missing weekly boundary at index ${index}.`);
    const start = anchor.time;
    const end = weeks[index + 1]?.time ?? start + MS_PER_WEEK;
    return Math.round(start + (end - start) * (position - index));
  };

  for (let j = 0; j < columns; j += 1) {
    const start = Math.floor((j * n) / columns);
    const end = Math.floor(((j + 1) * n) / columns);
    const startTime = boundaryTime((j * n) / columns);
    const endTime = boundaryTime(((j + 1) * n) / columns);

    if (end <= start) {
      // No observations in this bucket: carry the previous cumulative forward.
      buckets.push({
        startTime,
        endTime,
        observations: 0,
        added: 0,
        cumulative: previousCumulative,
      });
      continue;
    }

    let added = 0;
    for (let i = start; i < end; i += 1) {
      const week = weeks[i];
      if (week) {
        added += week.added;
      }
    }
    const endCumulative = cumulative[end - 1] ?? previousCumulative;
    buckets.push({
      startTime,
      endTime,
      observations: end - start,
      added,
      cumulative: endCumulative,
    });
    previousCumulative = endCumulative;
  }

  return buckets;
}

function emptyBuckets(columns: number, baseline: number): Bucket[] {
  const buckets: Bucket[] = [];
  for (let j = 0; j < columns; j += 1) {
    buckets.push({
      startTime: 0,
      endTime: 0,
      observations: 0,
      added: 0,
      cumulative: baseline,
    });
  }
  return buckets;
}
