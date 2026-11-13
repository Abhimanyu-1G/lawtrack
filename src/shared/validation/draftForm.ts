import type { DraftType } from '../enums';
import { DRAFT_TYPES } from '../enums';
import type { FieldError, ValidationResult } from '../errors';
import { getDictionary, type Locale } from '../../i18n';
import { asRecord, charCount, readNumber, readString } from './fields';
import { isRealDate } from './dates';
import { invalidLabel, localeOf } from './messages';
import { fail, ok } from './result';

/**
 * Draft wizard form definitions and server-side validation (AGENTS.md §9).
 *
 * One shared declaration drives the client wizard and the server validator, so
 * a field can never exist in the UI but be ignored by the API (or vice versa).
 * The stored `form_data` column is the serialised answer object; its length is
 * capped at 5000 characters exactly like `Legal_Draft.form_data`.
 */

export type DraftFieldKind = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox';

export interface DraftFieldOption {
  value: string;
  /** Dictionary key under `drafts.fields`. */
  labelKey: string;
}

export interface DraftField {
  name: string;
  kind: DraftFieldKind;
  required: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: DraftFieldOption[];
}

export const DRAFT_FORM_FIELDS: Record<DraftType, DraftField[]> = {
  Complaint: [
    { name: 'complainantName', kind: 'text', required: true, maxLength: 100 },
    { name: 'complainantAddress', kind: 'textarea', required: true, maxLength: 255 },
    { name: 'oppositeParty', kind: 'text', required: true, maxLength: 150 },
    { name: 'incidentDate', kind: 'date', required: true },
    { name: 'incidentPlace', kind: 'text', required: true, maxLength: 150 },
    { name: 'facts', kind: 'textarea', required: true, maxLength: 1500 },
    { name: 'lossImpact', kind: 'textarea', required: true, maxLength: 800 },
    { name: 'reliefSought', kind: 'textarea', required: true, maxLength: 600 },
    { name: 'documents', kind: 'textarea', required: false, maxLength: 500 },
  ],
  RTI: [
    { name: 'applicantName', kind: 'text', required: true, maxLength: 100 },
    { name: 'applicantAddress', kind: 'textarea', required: true, maxLength: 255 },
    { name: 'publicAuthority', kind: 'text', required: true, maxLength: 150 },
    { name: 'pio', kind: 'text', required: false, maxLength: 120 },
    {
      name: 'level',
      kind: 'select',
      required: true,
      options: [
        { value: 'State', labelKey: 'levelState' },
        { value: 'Central', labelKey: 'levelCentral' },
      ],
    },
    { name: 'information', kind: 'textarea', required: true, maxLength: 1200 },
    { name: 'period', kind: 'text', required: false, maxLength: 120 },
    { name: 'bpl', kind: 'checkbox', required: false },
    {
      name: 'replyMode',
      kind: 'select',
      required: true,
      options: [
        { value: 'Post', labelKey: 'replyPost' },
        { value: 'Email', labelKey: 'replyEmail' },
        { value: 'In person', labelKey: 'replyInPerson' },
      ],
    },
  ],
  'Legal Notice': [
    { name: 'senderName', kind: 'text', required: true, maxLength: 100 },
    { name: 'senderAddress', kind: 'textarea', required: true, maxLength: 255 },
    { name: 'recipientName', kind: 'text', required: true, maxLength: 150 },
    { name: 'recipientAddress', kind: 'textarea', required: true, maxLength: 255 },
    { name: 'relationship', kind: 'text', required: true, maxLength: 100 },
    { name: 'facts', kind: 'textarea', required: true, maxLength: 1500 },
    { name: 'demand', kind: 'textarea', required: true, maxLength: 800 },
    { name: 'deadlineDays', kind: 'number', required: true, min: 7, max: 90 },
    { name: 'consequence', kind: 'textarea', required: true, maxLength: 600 },
  ],
};

export type DraftAnswers = Record<string, string | number | boolean>;

export interface ValidDraftForm {
  type: DraftType;
  answers: DraftAnswers;
  /** JSON string stored in `Legal_Draft.form_data`. */
  serialized: string;
}

export const DRAFT_DEADLINE_MIN = 7;
export const DRAFT_DEADLINE_MAX = 90;
export const DRAFT_REMARKS_MIN = 10;
export const DRAFT_REMARKS_MAX = 1000;

function isDraftType(value: string): value is DraftType {
  return (DRAFT_TYPES as readonly string[]).includes(value);
}

function labelOf(field: string, locale: Locale): string {
  const labels = getDictionary(locale).drafts.fields as Record<string, string>;
  return labels[field] ?? field;
}

/**
 * Validate the wizard answers for one draft type. Blank optional fields are
 * dropped so the stored JSON stays small and the AI prompt has no empty keys.
 */
export function validateDraftFormInput(
  typeInput: unknown,
  formInput: unknown,
  localeInput: Locale,
): ValidationResult<ValidDraftForm> {
  const locale = localeOf(localeInput);
  const typeRead = readString(asRecord({ type: typeInput }), 'type');

  if (typeRead.status !== 'ok' || !isDraftType(typeRead.value)) {
    return fail([
      invalidLabel('draft_type', labelOf('draftType', locale), 'ENUM', locale, 'invalidEnum', {
        allowed: DRAFT_TYPES.join(', '),
      }),
    ]);
  }

  const type = typeRead.value;
  const fields = DRAFT_FORM_FIELDS[type];
  const record = asRecord(formInput);
  const errors: FieldError[] = [];
  const answers: DraftAnswers = {};

  for (const field of fields) {
    const raw = record[field.name];
    const label = labelOf(field.name, locale);

    if (field.kind === 'checkbox') {
      if (typeof raw === 'boolean') answers[field.name] = raw;
      else if (raw === undefined || raw === null) answers[field.name] = false;
      else errors.push(invalidLabel(field.name, label, 'TYPE', locale, 'invalidType'));
      continue;
    }

    if (field.kind === 'number') {
      const read = readNumber(record, field.name);
      if (read.status === 'missing') {
        if (field.required) errors.push(invalidLabel(field.name, label, 'REQUIRED', locale, 'required'));
        continue;
      }
      if (read.status === 'invalid' || !Number.isInteger(read.value)) {
        errors.push(invalidLabel(field.name, label, 'TYPE', locale, 'invalidType'));
        continue;
      }
      if (
        (field.min !== undefined && read.value < field.min) ||
        (field.max !== undefined && read.value > field.max)
      ) {
        errors.push(
          invalidLabel(field.name, label, 'FORMAT', locale, 'integerRange', {
            min: field.min ?? 0,
            max: field.max ?? 0,
          }),
        );
        continue;
      }
      answers[field.name] = read.value;
      continue;
    }

    const read = readString(record, field.name);
    if (read.status === 'missing') {
      if (field.required) errors.push(invalidLabel(field.name, label, 'REQUIRED', locale, 'required'));
      continue;
    }
    if (read.status === 'invalid') {
      errors.push(invalidLabel(field.name, label, 'TYPE', locale, 'invalidType'));
      continue;
    }
    if (field.maxLength !== undefined && charCount(read.value) > field.maxLength) {
      errors.push(invalidLabel(field.name, label, 'LENGTH', locale, 'tooLong', { max: field.maxLength }));
      continue;
    }
    if (field.kind === 'date') {
      if (!isRealDate(read.value)) {
        errors.push(invalidLabel(field.name, label, 'INVALID_DATE', locale, 'invalidDate'));
        continue;
      }
      answers[field.name] = read.value;
      continue;
    }
    if (field.kind === 'select') {
      const allowed = (field.options ?? []).map((option) => option.value);
      if (!allowed.includes(read.value)) {
        errors.push(
          invalidLabel(field.name, label, 'ENUM', locale, 'invalidEnum', { allowed: allowed.join(', ') }),
        );
        continue;
      }
    }
    answers[field.name] = read.value;
  }

  if (errors.length > 0) return fail(errors);

  const serialized = JSON.stringify(answers);
  if (charCount(serialized) > 5000) {
    return fail([
      invalidLabel('form_data', labelOf('formData', locale), 'LENGTH', locale, 'tooLong', { max: 5000 }),
    ]);
  }

  return ok({ type, answers, serialized });
}

/** Reject/approve remarks: required on rejection and at least 10 characters. */
export function validateReviewRemarks(
  input: unknown,
  localeInput: Locale,
): ValidationResult<{ remarks: string }> {
  const locale = localeOf(localeInput);
  const read = readString(asRecord(input), 'remarks');
  const label = labelOf('remarks', locale);

  if (read.status === 'missing') {
    return fail([invalidLabel('remarks', label, 'REQUIRED', locale, 'required')]);
  }
  if (read.status === 'invalid') {
    return fail([invalidLabel('remarks', label, 'TYPE', locale, 'invalidType')]);
  }
  if (charCount(read.value) < DRAFT_REMARKS_MIN) {
    return fail([
      invalidLabel('remarks', label, 'LENGTH', locale, 'tooShort', { min: DRAFT_REMARKS_MIN }),
    ]);
  }
  if (charCount(read.value) > DRAFT_REMARKS_MAX) {
    return fail([
      invalidLabel('remarks', label, 'LENGTH', locale, 'tooLong', { max: DRAFT_REMARKS_MAX }),
    ]);
  }

  return ok({ remarks: read.value });
}

export type DraftTransitionDecision = 'approve' | 'reject';

const ALLOWED_DECISIONS: Record<string, DraftTransitionDecision[]> = {
  'Pending Review': ['approve', 'reject'],
};

/**
 * Pure guard for the review state machine. `Approved` is terminal; only a draft
 * currently in `Pending Review` may be approved or rejected.
 */
export function canDecide(
  status: string,
  decision: DraftTransitionDecision,
): boolean {
  return (ALLOWED_DECISIONS[status] ?? []).includes(decision);
}
