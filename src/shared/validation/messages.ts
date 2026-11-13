import { getDictionary, type Locale } from '../../i18n';
import type { FieldError, ValidationCode } from '../errors';

/**
 * Message helpers for validators (AGENTS.md §1.8, §5).
 *
 * Every message is a template from the shared dictionaries, so English and
 * Hindi stay in sync. A rule reports at most one message per field: the first
 * one that fails.
 */

type ValidationDictionary = ReturnType<typeof getDictionary>['validation'];
export type ValidationField = keyof ValidationDictionary['fields'];
type RuleKey = Exclude<keyof ValidationDictionary, 'fields'>;

export function localeOf(locale: Locale | undefined): Locale {
  return locale ?? 'en';
}

export function fieldLabel(field: ValidationField, locale: Locale): string {
  return getDictionary(locale).validation.fields[field];
}

function interpolate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in variables ? String(variables[name]) : match,
  );
}

/** Render a dictionary template with `{{placeholders}}` filled in. */
export function describe(
  locale: Locale,
  key: RuleKey,
  variables: Record<string, string | number> = {},
): string {
  const template = getDictionary(locale).validation[key];
  return interpolate(template, variables);
}

/**
 * Build a field error with an explicit display label. The wizard reports its
 * own field names (which are not part of the fixed user/draft/case tables), so
 * it resolves the label from `drafts.fields` and reuses the same rule text.
 * `field` always stays the machine-readable name the client form matches on.
 */
export function invalidLabel(
  field: string,
  label: string,
  code: ValidationCode,
  locale: Locale,
  key: RuleKey,
  variables: Record<string, string | number> = {},
): FieldError {
  return {
    field,
    code,
    message: describe(locale, key, { field: label, ...variables }),
  };
}

/**
 * Build a field error. `messages` decide the wording; the caller only supplies
 * the code, the rule key and any interpolation values.
 */
export function invalid(
  field: ValidationField,
  code: ValidationCode,
  locale: Locale,
  key: RuleKey,
  variables: Record<string, string | number> = {},
): FieldError {
  return invalidLabel(field, fieldLabel(field, locale), code, locale, key, variables);
}
