import { getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import { ApiError } from './errors.js';

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

export const realTimers: Timers = {
  now: () => Date.now(),
  sleep: async (ms) => {
    // Node clamps larger delays to 1ms; chunk long, explicitly budgeted waits.
    let remaining = ms;
    while (remaining > 0) {
      const chunk = Math.min(remaining, 2_147_483_647);
      await new Promise((resolve) => setTimeout(resolve, chunk));
      remaining -= chunk;
    }
  },
};

export interface RetryOptions {
  readonly maxAttempts?: number;
  readonly requestTimeoutMs?: number;
  readonly budgetMs?: number;
  readonly timers?: Timers;
  /** Absolute start time of the overall budget window. */
  readonly startedAt?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_BUDGET_MS = 5 * 60_000;
const MIN_SECONDARY_WAIT_MS = 60_000;

const API_VERSION = '2026-03-10';

/** Creates a real client bound to a token (empty token -> unauthenticated). */
export function createClient(token: string): ApiClient {
  // Route through the live global fetch so tests can stub the network and the
  // action always uses the current runtime fetch implementation.
  const options = {
    request: {
      fetch: (
        url: string | URL | Request,
        init?: RequestInit,
      ): Promise<Response> => globalThis.fetch(url, init),
    },
  };
  const octokit = token ? getOctokit(token, options) : new GitHub(options);
  return {
    async request(
      route: string,
      params: Record<string, unknown>,
    ): Promise<ApiResponse> {
      const response = await octokit.request(route, params);
      return {
        status: response.status,
        headers: response.headers as Record<string, string | undefined>,
        data: response.data as unknown,
      };
    },
  };
}

/** Standard headers for the star history / metadata endpoints. */
export function standardHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': API_VERSION,
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

interface HttpLike {
  status?: number;
  message?: string;
  response?: { headers?: Record<string, string | undefined> };
}

/**
 * Performs a request with bounded retries for transient/5xx/rate-limit
 * failures, honouring Retry-After and rate-limit reset headers within an
 * overall budget. Never retries deterministic client errors (4xx except 403
 * rate limits).
 */
export async function requestWithRetry<T>(
  client: ApiClient,
  operation: string,
  route: string,
  params: Record<string, unknown>,
  options: RetryOptions = {},
): Promise<ApiResponse<T>> {
  const timers = options.timers ?? realTimers;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const startedAt = options.startedAt ?? timers.now();

  function remainingBudgetMs(): number {
    const remaining = budgetMs - (timers.now() - startedAt);
    if (remaining <= 0) {
      throw new ApiError(
        `${operation} exceeded the ${Math.round(budgetMs / 1000)}s API budget. ` +
          'Retry later or increase the API budget.',
        operation,
      );
    }
    return remaining;
  }

  let attempt = 0;

  for (;;) {
    attempt += 1;
    const remainingMs = remainingBudgetMs();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.min(timeoutMs, remainingMs),
    );
    let response: ApiResponse;
    try {
      try {
        response = await client.request(route, {
          ...params,
          request: { signal: controller.signal },
        });
        // Octokit can swallow a body-read abort and resolve an empty 200.
        if (controller.signal.aborted) {
          throw new ApiError(
            `${operation} timed out after ${timeoutMs}ms. ` +
              'Retry later or increase the request timeout.',
            operation,
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const http = error as HttpLike;
      const status = typeof http.status === 'number' ? http.status : undefined;
      const retryable = isRetryable(status, error);

      if (!retryable) {
        throw error;
      }
      remainingBudgetMs();
      if (attempt >= maxAttempts) {
        throw error;
      }

      const waitMs = retryDelayMs(
        status,
        http.response?.headers,
        attempt,
        timers.now(),
      );
      if (timers.now() + waitMs - startedAt >= budgetMs) {
        const retryTime = new Date(timers.now() + waitMs);
        const retryAt = Number.isFinite(retryTime.getTime())
          ? retryTime.toISOString()
          : 'the server-requested wait (beyond the supported date range)';
        throw new ApiError(
          `${operation} would exceed the API budget while waiting ` +
            `${Math.ceil(waitMs / 1000)}s. Retry at or after ${retryAt}, ` +
            'or increase the API budget; no early retry was sent.',
          operation,
          status,
        );
      }
      await timers.sleep(waitMs);
      continue;
    }
    remainingBudgetMs();
    return response as ApiResponse<T>;
  }
}

function isRetryable(status: number | undefined, error: unknown): boolean {
  if (status === undefined) {
    // Network-level errors (timeouts, resets) are retryable.
    if (error instanceof Error && error.name === 'AbortError') {
      return true;
    }
    return error instanceof Error;
  }
  if (status === 403 || status === 429) {
    return true; // primary/secondary rate limits
  }
  return status >= 500 && status < 600;
}

function retryDelayMs(
  status: number | undefined,
  headers: Record<string, string | undefined> | undefined,
  attempt: number,
  nowMs: number,
): number {
  const retryAfter = headers?.['retry-after'];
  let requiredWait = 0;
  let hasServerWait = false;
  if (retryAfter) {
    const seconds = /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
      ? Number(retryAfter)
      : NaN;
    const wait = !Number.isNaN(seconds)
      ? seconds * 1000
      : /[a-z]/i.test(retryAfter)
        ? Date.parse(retryAfter) - nowMs
        : NaN;
    if (!Number.isNaN(wait)) {
      requiredWait = Math.max(0, wait);
      hasServerWait = true;
    }
  }

  const remaining = headers?.['x-ratelimit-remaining'];
  const reset = headers?.['x-ratelimit-reset'];
  if (remaining === '0' && reset && /^\d+(?:\.\d+)?$/.test(reset)) {
    const resetMs = Number(reset) * 1000;
    if (!Number.isNaN(resetMs)) {
      requiredWait = Math.max(requiredWait, resetMs - nowMs);
      hasServerWait = true;
    }
  }
  if (hasServerWait) return requiredWait;

  // Secondary rate limit without headers: wait at least a minute.
  if (status === 403 || status === 429) {
    return MIN_SECONDARY_WAIT_MS;
  }

  // Exponential backoff for transient/5xx failures.
  const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000);
  return backoff;
}
