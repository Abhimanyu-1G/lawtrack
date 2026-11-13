/**
 * Validation context (AGENTS.md §5).
 *
 * Validators are pure functions: they never touch the database or the system
 * clock directly. Callers pass a clock, existence/uniqueness probes and the
 * locale used for human-readable messages. Unit tests build a literal context,
 * while route handlers adapt their repositories.
 */

import type { Clock } from '../clock';
import type { Locale } from '../../i18n';

/** Tables a validator may reference through a foreign key. */
export const VALIDATION_TABLES = ['Citizen', 'API_Integration'] as const;
export type ValidationTable = (typeof VALIDATION_TABLES)[number];

/** Fields that carry a uniqueness constraint in the schema. */
export const VALIDATION_UNIQUE_FIELDS = ['email', 'cnr_number'] as const;
export type ValidationUniqueField = (typeof VALIDATION_UNIQUE_FIELDS)[number];

export interface ValidationContext {
  clock: Clock;
  /**
   * `true` when a row with this primary key exists in `table`. May be async:
   * tests and client code pass a literal, services pass a repository lookup.
   */
  exists(table: ValidationTable, id: number): boolean | Promise<boolean>;
  /** `true` when no other row already uses `value` for `field`. */
  isUnique(field: ValidationUniqueField, value: string): boolean | Promise<boolean>;
  /** Language for field messages; defaults to English. */
  locale?: Locale;
}
