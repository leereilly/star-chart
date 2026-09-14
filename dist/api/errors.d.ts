/** Structured, credential-safe API errors. */
export declare class ApiError extends Error {
    readonly status: number | undefined;
    readonly operation: string;
    constructor(message: string, operation: string, status?: number);
}
export interface HttpErrorLike {
    status?: number;
    message?: string;
    response?: {
        headers?: Record<string, string | undefined>;
    };
}
/** Builds an actionable error for a failed request, never leaking bodies. */
export declare function describeHttpError(operation: string, repository: string, status: number | undefined): ApiError;
