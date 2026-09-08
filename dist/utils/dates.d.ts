import type { DateFormat } from '../models/index.js';
export declare const MS_PER_WEEK: number;
/**
 * Formats an epoch-ms instant in UTC using the selected display format.
 *
 * Display formatting is intentionally UTC and independent of the API's
 * (non-UTC-guaranteed) week boundaries; this only affects human labels.
 */
export declare function formatDate(time: number, format: DateFormat): string;
/** Full ISO-8601 UTC date (YYYY-MM-DD) for outputs. */
export declare function isoDate(time: number): string;
/**
 * Returns the nearest whole number of seven-day steps between two instants,
 * tolerating civil-time (DST) shifts of a few hours without rounding to the
 * wrong week.
 */
export declare function weekStepsBetween(fromTime: number, toTime: number): number;
/**
 * Floors an instant to the start of its UTC calendar week (Sunday 00:00 UTC).
 *
 * Used to align weekly observations from different repositories, whose API
 * week boundaries are not guaranteed to share an anchor.
 */
export declare function utcWeekStart(time: number): number;
