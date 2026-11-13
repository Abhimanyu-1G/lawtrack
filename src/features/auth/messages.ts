import type { Dictionary } from '../../i18n';
import { ApiRequestError } from './api';

/**
 * Translate the API error contract into the active dictionary. Server-side
 * validation messages are already localized through `Accept-Language`; this
 * helper covers the application-level codes whose wording belongs to the form.
 */
export function formErrorMessage(error: unknown, dict: Dictionary): string {
  if (!(error instanceof ApiRequestError)) return dict.auth.genericError;

  switch (error.code) {
    case 'NETWORK':
      return dict.auth.networkError;
    case 'UNAUTHORIZED':
      return dict.auth.invalidCredentials;
    case 'ACCOUNT_NOT_VERIFIED':
      return dict.auth.accountNotVerified;
    case 'RATE_LIMITED':
      return dict.auth.rateLimited;
    case 'OTP_INVALID':
      return dict.auth.codeInvalid;
    case 'OTP_EXPIRED':
      return dict.auth.codeExpired;
    case 'OTP_ATTEMPTS_EXCEEDED':
      return dict.auth.tooManyAttempts;
    case 'VALIDATION_FAILED':
      return dict.auth.checkFields;
    case 'FORBIDDEN':
      return dict.error.title;
    default:
      return dict.auth.genericError;
  }
}

/** Map `fields[]` onto input ids so each error appears under its input. */
export function fieldErrorMap(error: unknown): Record<string, string> {
  if (!(error instanceof ApiRequestError)) return {};

  const map: Record<string, string> = {};
  for (const field of error.fields) {
    map[field.field] = field.message;
  }
  return map;
}
