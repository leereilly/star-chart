import type { RepositoryRef } from '../models/index.js';
import type { ApiClient, RetryOptions } from './client.js';
/** Raw weekly record as returned by the star history endpoint. */
export interface RawWeek {
    readonly timestamp: string;
    readonly total: number;
    readonly days: readonly number[];
}
/**
 * Fetches the complete available star history, newest-first pages ordered
 * toward repository creation, following `Link: next` until exhausted.
 *
 * For safety the next page is re-requested through the same typed route using
 * only the extracted page number; the raw Link URL is never fetched, so
 * credentials are never sent to an arbitrary target.
 */
export declare function fetchHistory(client: ApiClient, repository: RepositoryRef, token: string, retry?: RetryOptions): Promise<RawWeek[]>;
/**
 * Parses the `Link` header and returns the next page number, validating that
 * the next URL targets the same endpoint path (no arbitrary hosts/paths, no
 * non-advancing cycles). Returns null when there is no next page.
 */
export declare function nextPageFromLink(link: string | undefined, expectedPath: string, currentPage: number): number | null;
