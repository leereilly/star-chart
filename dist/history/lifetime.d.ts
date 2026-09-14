import type { NormalizedHistory } from '../models/index.js';
/**
 * Places recorded additions on a creation-to-now UTC weekly spine. Missing
 * coverage within a repository's lifetime is unknown, not evidence of zero
 * growth; only slots before its creation are known zero (for comparisons).
 */
export declare function creationHistory(history: NormalizedHistory, createdAt: string, asOf: number, rangeStart?: number): NormalizedHistory;
