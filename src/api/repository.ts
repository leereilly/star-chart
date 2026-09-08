import type { RepositoryMetadata, RepositoryRef } from '../models/index.js';
import type { ApiClient, RetryOptions } from './client.js';
import { requestWithRetry, standardHeaders } from './client.js';
import { ApiError, describeHttpError } from './errors.js';

interface RepoResponse {
  full_name?: unknown;
  created_at?: unknown;
  stargazers_count?: unknown;
  owner?: { login?: unknown };
  name?: unknown;
}

/** Fetches canonical repository metadata (created_at, name, current stars). */
export async function fetchRepository(
  client: ApiClient,
  repository: RepositoryRef,
  token: string,
  retry: RetryOptions = {},
): Promise<RepositoryMetadata> {
  const fullName = `${repository.owner}/${repository.repo}`;
  let response;
  try {
    response = await requestWithRetry<RepoResponse>(
      client,
      'repository metadata',
      'GET /repos/{owner}/{repo}',
      {
        owner: repository.owner,
        repo: repository.repo,
        headers: standardHeaders(token),
      },
      retry,
    );
  } catch (error) {
    throw toApiError(error, 'repository metadata', fullName);
  }

  const data = response.data;
  const createdAt = typeof data.created_at === 'string' ? data.created_at : '';
  const stargazersCount =
    typeof data.stargazers_count === 'number' ? data.stargazers_count : NaN;
  const canonicalName =
    typeof data.full_name === 'string' ? data.full_name : fullName;
  const owner =
    typeof data.owner?.login === 'string' ? data.owner.login : repository.owner;
  const name = typeof data.name === 'string' ? data.name : repository.repo;

  if (createdAt === '' || Number.isNaN(Date.parse(createdAt))) {
    throw new ApiError(
      `Repository metadata for ${fullName} is missing a valid created_at.`,
      'repository metadata',
      response.status,
    );
  }
  if (!Number.isFinite(stargazersCount) || stargazersCount < 0) {
    throw new ApiError(
      `Repository metadata for ${fullName} has an invalid star count.`,
      'repository metadata',
      response.status,
    );
  }

  return {
    owner,
    repo: name,
    fullName: canonicalName,
    createdAt,
    stargazersCount,
  };
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
