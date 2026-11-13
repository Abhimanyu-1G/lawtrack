import 'server-only';

import type { ApiErrorBody, ApiErrorCode, FieldError } from '../../shared/errors';

/**
 * Application error type + the single place that maps errors to HTTP.
 *
 * Contract (AGENTS.md §5): HTTP error bodies always look like
 * `{ error: { code, message, fields?, requestId } }`.
 */

export const HTTP_STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  DRAFT_NOT_APPROVED: 409,
  ACCOUNT_NOT_VERIFIED: 403,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  OTP_EXPIRED: 410,
  OTP_INVALID: 400,
  OTP_ATTEMPTS_EXCEEDED: 429,
  NOT_CONFIGURED: 503,
  UPSTREAM_UNAVAILABLE: 502,
  AI_UNAVAILABLE: 503,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  FORBIDDEN_ORIGIN: 403,
  INTERNAL_ERROR: 500,
};

export interface AppErrorOptions {
  status?: number;
  fields?: FieldError[];
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields?: FieldError[];

  constructor(code: ApiErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? HTTP_STATUS_BY_CODE[code];
    this.fields = options.fields;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function validationFailed(fields: FieldError[], message = 'Some fields need attention'): AppError {
  return new AppError('VALIDATION_FAILED', message, { fields });
}

export function unauthorized(message = 'Please sign in to continue'): AppError {
  return new AppError('UNAUTHORIZED', message);
}

export function forbidden(message = 'You do not have access to this resource'): AppError {
  return new AppError('FORBIDDEN', message);
}

export function notFound(message = 'We could not find what you were looking for'): AppError {
  return new AppError('NOT_FOUND', message);
}

export interface MappedError {
  status: number;
  body: ApiErrorBody;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Map any thrown value to the public error contract. Unexpected errors never
 * leak internals; the full error is logged by the caller.
 */
export function toErrorBody(error: unknown, requestId?: string): MappedError {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: GENERIC_MESSAGE,
        ...(requestId ? { requestId } : {}),
      },
    },
  };
}

export function isExpectedClientError(error: unknown): boolean {
  return isAppError(error) && error.status < 500;
}
