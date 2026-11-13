import type { FieldError, ValidationResult } from '../errors';
import { CATEGORY_NAMES } from '../enums';
import type { ValidationContext } from './context';
import { isRealDate } from './dates';
import { asRecord, charCount, readString } from './fields';
import { invalid, localeOf } from './messages';
import { fail, ok } from './result';

/**
 * Mock India Code "legislative change" trigger (AGENTS.md §11, UC-05).
 *
 * The payload describes which topic changed and why. It is deliberately small:
 * the mock adapter relays it to the curator queue, it never edits content.
 */

export const CHANGE_SUMMARY_MIN = 10;
export const CHANGE_SUMMARY_MAX = 300;
export const ACT_NAME_MAX = 200;

export interface LegislativeChangeInput {
  category: string;
  change_summary: string;
  act_name: string | null;
  effective_from: string | null;
}

export function validateLegislativeChangeInput(
  input: unknown,
  context: ValidationContext,
): ValidationResult<LegislativeChangeInput> {
  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const errors: FieldError[] = [];
  const output: LegislativeChangeInput = {
    category: '',
    change_summary: '',
    act_name: null,
    effective_from: null,
  };

  const category = readString(record, 'category');
  if (category.status === 'missing') {
    errors.push(invalid('category', 'REQUIRED', locale, 'required'));
  } else if (category.status === 'invalid') {
    errors.push(invalid('category', 'TYPE', locale, 'invalidType'));
  } else if (!(CATEGORY_NAMES as readonly string[]).includes(category.value)) {
    errors.push(
      invalid('category', 'ENUM', locale, 'invalidEnum', { allowed: CATEGORY_NAMES.join(', ') }),
    );
  } else {
    output.category = category.value;
  }

  const summary = readString(record, 'change_summary');
  if (summary.status === 'missing') {
    errors.push(invalid('change_summary', 'REQUIRED', locale, 'required'));
  } else if (summary.status === 'invalid') {
    errors.push(invalid('change_summary', 'TYPE', locale, 'invalidType'));
  } else if (charCount(summary.value) < CHANGE_SUMMARY_MIN) {
    errors.push(
      invalid('change_summary', 'LENGTH', locale, 'tooShort', { min: CHANGE_SUMMARY_MIN }),
    );
  } else if (charCount(summary.value) > CHANGE_SUMMARY_MAX) {
    errors.push(invalid('change_summary', 'LENGTH', locale, 'tooLong', { max: CHANGE_SUMMARY_MAX }));
  } else {
    output.change_summary = summary.value;
  }

  const actName = readString(record, 'act_name');
  if (actName.status === 'invalid') {
    errors.push(invalid('act_name', 'TYPE', locale, 'invalidType'));
  } else if (actName.status === 'ok') {
    if (charCount(actName.value) > ACT_NAME_MAX) {
      errors.push(invalid('act_name', 'LENGTH', locale, 'tooLong', { max: ACT_NAME_MAX }));
    } else {
      output.act_name = actName.value;
    }
  }

  const effectiveFrom = readString(record, 'effective_from');
  if (effectiveFrom.status === 'invalid') {
    errors.push(invalid('effective_from', 'TYPE', locale, 'invalidType'));
  } else if (effectiveFrom.status === 'ok') {
    if (!isRealDate(effectiveFrom.value)) {
      errors.push(invalid('effective_from', 'INVALID_DATE', locale, 'invalidDate'));
    } else {
      output.effective_from = effectiveFrom.value;
    }
  }

  return errors.length > 0 ? fail(errors) : ok(output);
}
