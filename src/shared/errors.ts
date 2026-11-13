/**
 * Shared error contract (AGENTS.md §5, §7).
 *
 * Validators and API responses use the same codes so client forms can map a
 * server response straight onto the offending field.
 */

export const VALIDATION_CODES = [
  'REQUIRED',
  'FORMAT',
  'LENGTH',
  'ENUM',
  'TYPE',
  'UNIQUE',
  'FK_NOT_FOUND',
  'FUTURE_DATE',
  'PAST_DATE',
  'INVALID_DATE',
] as const;
export type ValidationCode = (typeof VALIDATION_CODES)[number];

/** One field-level problem: `{ field, code, message }`. */
export interface FieldError {
  field: string;
  code: ValidationCode;
  message: string;
}

export interface ValidationFailure {
  ok: false;
  errors: FieldError[];
}

export interface ValidationSuccess<T> {
  ok: true;
  value: T;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/** Application-level error codes returned by the API. */
export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INVALID_TRANSITION',
  'DRAFT_NOT_APPROVED',
  'ACCOUNT_NOT_VERIFIED',
  'ACCOUNT_LOCKED',
  'RATE_LIMITED',
  'OTP_EXPIRED',
  'OTP_INVALID',
  'OTP_ATTEMPTS_EXCEEDED',
  'NOT_CONFIGURED',
  'UPSTREAM_UNAVAILABLE',
  'AI_UNAVAILABLE',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'FORBIDDEN_ORIGIN',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** The JSON body every error response carries. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: FieldError[];
    requestId?: string;
  };
}
