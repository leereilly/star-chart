import { utcFormat } from 'd3-time-format';
import type { DateFormat } from '../models/index.js';

const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

const shortFmt = utcFormat('%b %Y');
const longFmt = utcFormat('%b %-d, %Y');
const isoFmt = utcFormat('%Y-%m-%d');

/**
 * Formats an epoch-ms instant in UTC using the selected display format.
 *
 * Display formatting is intentionally UTC and independent of the API's
 * (non-UTC-guaranteed) week boundaries; this only affects human labels.
 */
export function formatDate(time: number, format: DateFormat): string {
  const date = new Date(time);
  switch (format) {
    case 'short':
      return shortFmt(date);
    case 'long':
      return longFmt(date);
    case 'iso':
      return isoFmt(date);
  }
}

/** Full ISO-8601 UTC date (YYYY-MM-DD) for outputs. */
export function isoDate(time: number): string {
  return isoFmt(new Date(time));
}

/**
 * Returns the nearest whole number of seven-day steps between two instants,
 * tolerating civil-time (DST) shifts of a few hours without rounding to the
 * wrong week.
 */
export function weekStepsBetween(fromTime: number, toTime: number): number {
  return Math.round((toTime - fromTime) / MS_PER_WEEK);
}

/**
 * Floors an instant to the start of its UTC calendar week (Sunday 00:00 UTC).
 *
 * Used to align weekly observations from different repositories, whose API
 * week boundaries are not guaranteed to share an anchor.
 */
export function utcWeekStart(time: number): number {
  const days = Math.floor(time / MS_PER_DAY);
  // 1970-01-01 was a Thursday, so shift by 4 days to make Sunday index 0.
  const weekday = (((days + 4) % 7) + 7) % 7;
  return (days - weekday) * MS_PER_DAY;
}
