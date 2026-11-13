import { createFixedClock } from '../../src/shared/clock';
import type { ValidationContext } from '../../src/shared/validation';
import type { Locale } from '../../src/i18n';

/**
 * Deterministic validation context: fixed clock at noon IST on 2026-11-10
 * (AGENTS.md §17) with an in-memory existence/uniqueness probe instead of a
 * database. Defaults follow the spec fixtures: citizen 12 and integration 1
 * exist; no email or CNR is registered unless a test asks for it.
 */

export const FIXED_NOW = '2026-11-10 12:00:00';
export const TODAY = '2026-11-10';
export const TOMORROW = '2026-11-11';
export const YESTERDAY = '2026-11-09';

export interface ValidationContextOptions {
  citizens?: number[];
  integrations?: number[];
  emails?: string[];
  cnrs?: string[];
  locale?: Locale;
}

export function createValidationContext(options: ValidationContextOptions = {}): ValidationContext {
  const citizens = new Set(options.citizens ?? [12]);
  const integrations = new Set(options.integrations ?? [1]);
  const emails = new Set((options.emails ?? []).map((email) => email.toLowerCase()));
  const cnrs = new Set((options.cnrs ?? []).map((cnr) => cnr.toUpperCase()));

  return {
    clock: createFixedClock(FIXED_NOW),
    exists(table, id) {
      return table === 'Citizen' ? citizens.has(id) : integrations.has(id);
    },
    isUnique(field, value) {
      return field === 'email' ? !emails.has(value.toLowerCase()) : !cnrs.has(value.toUpperCase());
    },
    locale: options.locale ?? 'en',
  };
}

/** Override one or more fields on a valid base payload. */
export function withFields<T extends object>(
  base: T,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return { ...base, ...overrides };
}

/** Remove a field so "absent" can be tested without `delete` gymnastics. */
export function withoutField(base: Record<string, unknown>, field: string): Record<string, unknown> {
  const copy = { ...base };
  delete copy[field];
  return copy;
}
