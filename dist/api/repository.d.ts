import type { RepositoryMetadata, RepositoryRef } from '../models/index.js';
import type { ApiClient, RetryOptions } from './client.js';
/** Fetches canonical repository metadata (created_at, name, current stars). */
export declare function fetchRepository(client: ApiClient, repository: RepositoryRef, token: string, retry?: RetryOptions): Promise<RepositoryMetadata>;
