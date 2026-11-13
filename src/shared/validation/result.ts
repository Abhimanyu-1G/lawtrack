import type {
  FieldError,
  ValidationCode,
  ValidationFailure,
  ValidationResult,
  ValidationSuccess,
} from '../errors';

/** Small builders so validators read as a list of rules (AGENTS.md §5). */

export function ok<T>(value: T): ValidationSuccess<T> {
  return { ok: true, value };
}

export function fail(errors: FieldError[]): ValidationFailure {
  return { ok: false, errors };
}

export function fieldError(field: string, code: ValidationCode, message: string): FieldError {
  return { field, code, message };
}

/** Convenience for tests and services that only need the first problem. */
export function firstError(result: ValidationResult<unknown>): FieldError | null {
  return result.ok ? null : (result.errors[0] ?? null);
}
