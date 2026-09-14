/**
 * Pure aggregation helpers for multi-repository charts.
 *
 * Aggregation is a sum, not a comparison: several repositories collapse into a
 * single history and a single synthetic metadata record, which the rest of the
 * pipeline then treats exactly like one repository.
 */
import type { NormalizedHistory, RepositoryMetadata } from '../models/index.js';
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
export declare function aggregateHistories(histories: readonly NormalizedHistory[]): NormalizedHistory;
/**
 * Collapses repository metadata into a single aggregate record: summed stars,
 * the earliest creation time, and a compact display name.
 */
export declare function aggregateMetadata(entries: readonly RepositoryMetadata[]): RepositoryMetadata;
/**
 * Builds the aggregate display name: two repositories are joined in full, and
 * longer lists are summarised so header titles stay legible.
 */
export declare function aggregateDisplayName(entries: readonly RepositoryMetadata[]): string;
