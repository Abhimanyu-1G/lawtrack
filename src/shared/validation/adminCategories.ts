import type { FieldError, ValidationResult } from '../errors';
import type { ValidationContext } from './context';
import { asRecord, charCount } from './fields';
import { invalid, localeOf } from './messages';
import { fail, ok } from './result';

/**
 * Administrator category management (AGENTS.md §7, PROMPTS Phase 3).
 *
 * Categories are display labels over the stable `Legal_Guide.category` text
 * column, so they live in `System_Setting` rather than in a new table. The list
 * is ordered, unique case-insensitively, and bounded to keep the filter usable.
 */

export const CATEGORY_LIST_MAX = 30;
export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 50;

export interface CategoryListInput {
  categories: string[];
}

export function validateCategoryListInput(
  input: unknown,
  context: ValidationContext,
): ValidationResult<CategoryListInput> {
  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const errors: FieldError[] = [];

  if (!Array.isArray(record.categories)) {
    return fail([invalid('category', 'TYPE', locale, 'invalidType')]);
  }
  if (record.categories.length === 0) {
    return fail([invalid('category', 'REQUIRED', locale, 'required')]);
  }
  if (record.categories.length > CATEGORY_LIST_MAX) {
    return fail([invalid('category', 'LENGTH', locale, 'tooLong', { max: CATEGORY_LIST_MAX })]);
  }

  const seen = new Set<string>();
  const categories: string[] = [];

  for (const raw of record.categories) {
    if (typeof raw !== 'string') {
      errors.push(invalid('category', 'TYPE', locale, 'invalidType'));
      continue;
    }
    const value = raw.trim();
    if (value === '') {
      errors.push(invalid('category', 'REQUIRED', locale, 'required'));
      continue;
    }
    if (charCount(value) < CATEGORY_NAME_MIN || charCount(value) > CATEGORY_NAME_MAX) {
      errors.push(
        invalid('category', 'LENGTH', locale, 'between', {
          min: CATEGORY_NAME_MIN,
          max: CATEGORY_NAME_MAX,
        }),
      );
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      errors.push(invalid('category', 'UNIQUE', locale, 'categoryDuplicate'));
      continue;
    }
    seen.add(key);
    categories.push(value);
  }

  return errors.length > 0 ? fail(errors) : ok({ categories });
}
