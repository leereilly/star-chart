/** Minimal response shape used by the pipeline. */
export interface ApiResponse<T = unknown> {
    readonly status: number;
    readonly headers: Record<string, string | undefined>;
    readonly data: T;
}
/** Injectable HTTP client abstraction over Octokit's generic request. */
export interface ApiClient {
    request(route: string, params: Record<string, unknown>): Promise<ApiResponse>;
}
/** Timing hooks (injected in tests for determinism). */
export interface Timers {
    now(): number;
    sleep(ms: number): Promise<void>;
}
export declare const realTimers: Timers;
export interface RetryOptions {
    readonly maxAttempts?: number;
    readonly requestTimeoutMs?: number;
    readonly budgetMs?: number;
    readonly timers?: Timers;
    /** Absolute start time of the overall budget window. */
    readonly startedAt?: number;
}
/** Creates a real client bound to a token (empty token -> unauthenticated). */
export declare function createClient(token: string): ApiClient;
/** Standard headers for the star history / metadata endpoints. */
export declare function standardHeaders(token: string): Record<string, string>;
/**
 * Performs a request with bounded retries for transient/5xx/rate-limit
 * failures, honouring Retry-After and rate-limit reset headers within an
 * overall budget. Never retries deterministic client errors (4xx except 403
 * rate limits).
 */
export declare function requestWithRetry<T>(client: ApiClient, operation: string, route: string, params: Record<string, unknown>, options?: RetryOptions): Promise<ApiResponse<T>>;
