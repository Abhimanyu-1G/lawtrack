import type { FieldError, ValidationResult } from '../errors';
import type { GuideStatus } from '../enums';
import { GUIDE_STATUSES } from '../enums';
import type { ValidationContext } from './context';
import { asRecord, charCount, readString } from './fields';
import { invalid, localeOf } from './messages';
import { fail, ok } from './result';

/**
 * Curator guide validation (Phase 3, AGENTS.md §6).
 *
 * Only content fields are editable through PATCH. `validation_status` and
 * `language` are system-managed: status changes go through the explicit
 * validate/flag actions so the state machine, audit log and embedding refresh
 * all run in one place.
 */

export const GUIDE_TITLE_MIN = 3;
export const GUIDE_TITLE_MAX = 150;
export const GUIDE_CATEGORY_MIN = 2;
export const GUIDE_CATEGORY_MAX = 50;
export const GUIDE_SUMMARY_MIN = 20;
export const GUIDE_SUMMARY_MAX = 8000;
export const GUIDE_STATUTE_MIN = 2;
export const GUIDE_STATUTE_MAX = 200;
export const GUIDE_EXCERPT_MAX = 2000;
export const GUIDE_REASON_MIN = 10;
export const GUIDE_REASON_MAX = 500;

export interface GuideUpdateInput {
  title?: string;
  category?: string;
  plain_summary?: string;
  source_statute?: string;
  source_excerpt?: string | null;
}

export interface GuideFlagInput {
  reason: string;
}

/** The only allowed guide status moves (AGENTS.md §6). */
export function canTransitionGuide(from: GuideStatus, to: GuideStatus): boolean {
  if (from === to) return true;
  return (
    (from === 'Draft' && to === 'Valid') ||
    (from === 'Requires AI Update' && to === 'Valid') ||
    (from === 'Valid' && to === 'Requires AI Update')
  );
}

export function isGuideStatus(value: string): value is GuideStatus {
  return (GUIDE_STATUSES as readonly string[]).includes(value);
}

function checkBounded(
  field: 'title' | 'category' | 'plain_summary' | 'source_statute',
  raw: ReturnType<typeof readString>,
  bounds: { min: number; max: number },
  locale: ReturnType<typeof localeOf>,
): { value?: string; error?: FieldError } {
  if (raw.status === 'missing') return { error: invalid(field, 'REQUIRED', locale, 'required') };
  if (raw.status === 'invalid') return { error: invalid(field, 'TYPE', locale, 'invalidType') };

  const length = charCount(raw.value);
  if (length < bounds.min || length > bounds.max) {
    return { error: invalid(field, 'LENGTH', locale, 'between', bounds) };
  }
  return { value: raw.value };
}

export function validateGuideUpdate(
  input: unknown,
  context: ValidationContext,
): ValidationResult<GuideUpdateInput> {
  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const errors: FieldError[] = [];
  const output: GuideUpdateInput = {};

  if (record.validation_status !== undefined) {
    errors.push(invalid('validation_status', 'FORMAT', locale, 'guideSystemManaged'));
  }
  if (record.language !== undefined) {
    errors.push(invalid('language', 'FORMAT', locale, 'guideSystemManaged'));
  }

  if (record.title !== undefined) {
    const checked = checkBounded(
      'title',
      readString(record, 'title'),
      { min: GUIDE_TITLE_MIN, max: GUIDE_TITLE_MAX },
      locale,
    );
    if (checked.error) errors.push(checked.error);
    else if (checked.value !== undefined) output.title = checked.value;
  }

  if (record.category !== undefined) {
    const checked = checkBounded(
      'category',
      readString(record, 'category'),
      { min: GUIDE_CATEGORY_MIN, max: GUIDE_CATEGORY_MAX },
      locale,
    );
    if (checked.error) errors.push(checked.error);
    else if (checked.value !== undefined) output.category = checked.value;
  }

  if (record.plain_summary !== undefined) {
    const checked = checkBounded(
      'plain_summary',
      readString(record, 'plain_summary'),
      { min: GUIDE_SUMMARY_MIN, max: GUIDE_SUMMARY_MAX },
      locale,
    );
    if (checked.error) errors.push(checked.error);
    else if (checked.value !== undefined) output.plain_summary = checked.value;
  }

  if (record.source_statute !== undefined) {
    const checked = checkBounded(
      'source_statute',
      readString(record, 'source_statute'),
      { min: GUIDE_STATUTE_MIN, max: GUIDE_STATUTE_MAX },
      locale,
    );
    if (checked.error) errors.push(checked.error);
    else if (checked.value !== undefined) output.source_statute = checked.value;
  }

  if (record.source_excerpt !== undefined) {
    if (record.source_excerpt === null) {
      output.source_excerpt = null;
    } else {
      const raw = readString(record, 'source_excerpt');
      if (raw.status === 'invalid') {
        errors.push(invalid('source_excerpt', 'TYPE', locale, 'invalidType'));
      } else if (raw.status === 'missing') {
        output.source_excerpt = null;
      } else if (charCount(raw.value) > GUIDE_EXCERPT_MAX) {
        errors.push(
          invalid('source_excerpt', 'LENGTH', locale, 'tooLong', { max: GUIDE_EXCERPT_MAX }),
        );
      } else {
        output.source_excerpt = raw.value;
      }
    }
  }

  return errors.length > 0 ? fail(errors) : ok(output);
}

export function validateGuideFlagInput(
  input: unknown,
  context: ValidationContext,
): ValidationResult<GuideFlagInput> {
  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const raw = readString(record, 'reason');

  if (raw.status === 'missing') {
    return fail([invalid('reason', 'REQUIRED', locale, 'required')]);
  }
  if (raw.status === 'invalid') {
    return fail([invalid('reason', 'TYPE', locale, 'invalidType')]);
  }

  const length = charCount(raw.value);
  if (length < GUIDE_REASON_MIN) {
    return fail([
      invalid('reason', 'LENGTH', locale, 'guideReasonTooShort', { min: GUIDE_REASON_MIN }),
    ]);
  }
  if (length > GUIDE_REASON_MAX) {
    return fail([
      invalid('reason', 'LENGTH', locale, 'tooLong', { max: GUIDE_REASON_MAX }),
    ]);
  }

  return ok({ reason: raw.value });
}
