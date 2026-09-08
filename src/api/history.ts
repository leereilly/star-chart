import type { RepositoryRef } from '../models/index.js';
import type { ApiClient, RetryOptions } from './client.js';
import { requestWithRetry, standardHeaders } from './client.js';
import { ApiError, describeHttpError } from './errors.js';

const PER_PAGE = 30;
const MAX_PAGES = 100;

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
export async function fetchHistory(
  client: ApiClient,
  repository: RepositoryRef,
  token: string,
  retry: RetryOptions = {},
): Promise<RawWeek[]> {
  const fullName = `${repository.owner}/${repository.repo}`;
  const route = 'GET /repos/{owner}/{repo}/stargazers/history';
  const expectedPath = `/repos/${repository.owner}/${repository.repo}/stargazers/history`;

  const collected: RawWeek[] = [];
  let page = 1;
  let seenPages = 0;

  for (;;) {
    if (page > MAX_PAGES) {
      throw new ApiError(
        `Star history for ${fullName} exceeded the ${MAX_PAGES}-page limit.`,
        'star history',
      );
    }
    seenPages += 1;
    if (seenPages > MAX_PAGES) {
      throw new ApiError(
        `Star history pagination for ${fullName} did not terminate.`,
        'star history',
      );
    }

    let response;
    try {
      response = await requestWithRetry<unknown>(
        client,
        'star history',
        route,
        {
          owner: repository.owner,
          repo: repository.repo,
          per_page: PER_PAGE,
          page,
          headers: standardHeaders(token),
        },
        retry,
      );
    } catch (error) {
      throw toApiError(error, 'star history', fullName);
    }

    const items = parsePage(response.data, fullName, page);
    for (const item of items) {
      collected.push(item);
    }

    const nextPage = nextPageFromLink(
      response.headers.link,
      expectedPath,
      page,
    );
    if (nextPage === null) {
      break;
    }
    page = nextPage;
  }

  return collected;
}

function parsePage(data: unknown, fullName: string, page: number): RawWeek[] {
  if (!Array.isArray(data)) {
    throw new ApiError(
      `Star history response for ${fullName} (page ${page}) was not an array.`,
      'star history',
    );
  }
  return data.map((entry) => parseWeek(entry, fullName, page));
}

function parseWeek(entry: unknown, fullName: string, page: number): RawWeek {
  if (typeof entry !== 'object' || entry === null) {
    throw new ApiError(
      `Malformed star history entry for ${fullName} (page ${page}).`,
      'star history',
    );
  }
  const record = entry as Record<string, unknown>;
  const timestamp = extractTimestamp(record);
  if (timestamp === null) {
    throw new ApiError(
      `Star history entry for ${fullName} is missing a timestamp.`,
      'star history',
    );
  }
  const total = record.total;
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
    throw new ApiError(
      `Star history entry for ${fullName} has an invalid total.`,
      'star history',
    );
  }
  const days = record.days;
  if (
    !Array.isArray(days) ||
    days.length !== 7 ||
    !days.every((d) => typeof d === 'number' && Number.isFinite(d) && d >= 0)
  ) {
    throw new ApiError(
      `Star history entry for ${fullName} has invalid daily values.`,
      'star history',
    );
  }
  return {
    timestamp,
    total,
    days: days as number[],
  };
}

function extractTimestamp(record: Record<string, unknown>): string | null {
  for (const key of ['timestamp', 'week', 'date', 'start']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      // Heuristic: seconds vs milliseconds.
      const ms = value < 1e12 ? value * 1000 : value;
      return new Date(ms).toISOString();
    }
  }
  return null;
}

/**
 * Parses the `Link` header and returns the next page number, validating that
 * the next URL targets the same endpoint path (no arbitrary hosts/paths, no
 * non-advancing cycles). Returns null when there is no next page.
 */
export function nextPageFromLink(
  link: string | undefined,
  expectedPath: string,
  currentPage: number,
): number | null {
  if (!link) {
    return null;
  }
  const parts = link.split(',');
  for (const part of parts) {
    const match = /<([^>]+)>\s*;\s*rel="([^"]+)"/.exec(part.trim());
    if (!match) {
      continue;
    }
    const [, url, rel] = match;
    if (rel !== 'next' || !url) {
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ApiError(
        'Star history pagination returned an unparseable next link.',
        'star history',
      );
    }
    const validSuffix = parsed.pathname.endsWith('/stargazers/history');
    // Accept the canonical owner/repo path or GitHub's numeric-id pagination
    // form; reject anything else pointing at a different endpoint.
    if (!validSuffix && parsed.pathname !== expectedPath) {
      throw new ApiError(
        'Star history pagination pointed at an unexpected path.',
        'star history',
      );
    }
    const nextPage = Number.parseInt(parsed.searchParams.get('page') ?? '', 10);
    if (!Number.isFinite(nextPage) || nextPage <= currentPage) {
      throw new ApiError(
        'Star history pagination did not advance (possible cycle).',
        'star history',
      );
    }
    return nextPage;
  }
  return null;
}

function toApiError(
  error: unknown,
  operation: string,
  repository: string,
): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  const status =
    error && typeof error === 'object' && 'status' in error
      ? (error as { status?: number }).status
      : undefined;
  return describeHttpError(operation, repository, status);
}
