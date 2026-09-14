import type { NormalizedHistory } from '../models/index.js';
import type { RawWeek } from '../api/history.js';
export interface NormalizeOptions {
    /** Injected clock (epoch ms); observations after this are rejected. */
    readonly asOf: number;
    readonly warn?: (message: string) => void;
}
export declare class HistoryError extends Error {
    constructor(message: string);
}
/**
 * Validates, sorts, de-duplicates, and gap-fills raw weekly history, then
 * computes cumulative additions.
 *
 * Timestamps are preserved exactly (not UTC-floored). Internal gaps are filled
 * with synthetic zero weeks and flagged; interrupted pagination is the
 * fetcher's concern, not this function's.
 */
export declare function normalizeHistory(raw: readonly RawWeek[], options: NormalizeOptions): NormalizedHistory;
