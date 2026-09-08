import type { ChartConfig, PeriodName } from '../models/index.js';
/** Raw input map (string keyed) as delivered by the Action or programmatically. */
export type RawInputs = Record<string, string | undefined>;
export interface ParseOptions {
    /** Environment used for token/repository fallbacks. */
    readonly env?: NodeJS.ProcessEnv;
    /** Collects non-fatal warnings. */
    readonly warn?: (message: string) => void;
}
export interface ParsedConfig {
    readonly config: ChartConfig;
    /** Resolved token (may be empty for unauthenticated access). */
    readonly token: string;
}
/** Period name -> API week count. `all` selects the entire history. */
export declare const PERIOD_WEEKS: Record<Exclude<PeriodName, 'all'>, number>;
/**
 * Parses raw inputs into a fully validated {@link ChartConfig}.
 *
 * Pure: performs no network or filesystem access.
 */
export declare function parseInputs(raw: RawInputs, options?: ParseOptions): ParsedConfig;
