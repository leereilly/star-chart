import type { Bucket, WindowSelection } from '../models/index.js';
/**
 * Aggregates the selected weekly window into `columns` display buckets using
 * monotone integer partition boundaries `floor(j*N/K)`.
 *
 * Each bucket keeps the summed additions and the cumulative value at its end.
 * When there are more columns than observations (`K > N`), empty buckets carry
 * the previous cumulative value forward; no intra-week growth is fabricated.
 */
export declare function bucketWindow(window: WindowSelection, columns: number, baseline: number): Bucket[];
