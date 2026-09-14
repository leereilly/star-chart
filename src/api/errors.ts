/** Structured, credential-safe API errors. */

export class ApiError extends Error {
  readonly status: number | undefined;
  readonly operation: string;
  constructor(message: string, operation: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.operation = operation;
    this.status = status;
  }
}

export interface HttpErrorLike {
  status?: number;
  message?: string;
  response?: { headers?: Record<string, string | undefined> };
}

/** Builds an actionable error for a failed request, never leaking bodies. */
export function describeHttpError(
  operation: string,
  repository: string,
  status: number | undefined,
): ApiError {
  switch (status) {
    case 401:
      return new ApiError(
        `Authentication failed for ${operation} on ${repository}. ` +
          'Check that the token is valid and not expired.',
        operation,
        status,
      );
    case 403:
      return new ApiError(
        `Access forbidden for ${operation} on ${repository}. ` +
          'The token may lack permissions, or a rate limit was exceeded.',
        operation,
        status,
      );
    case 404:
      return new ApiError(
        `Repository ${repository} was not found for ${operation}. ` +
          'Verify the name and that the token can access it.',
        operation,
        status,
      );
    case 422:
      return new ApiError(
        `The request for ${operation} on ${repository} was rejected as ` +
          'invalid (422).',
        operation,
        status,
      );
    default:
      return new ApiError(
        `${operation} on ${repository} failed` +
          (status ? ` with status ${status}` : '') +
          '.',
        operation,
        status,
      );
  }
}
