import type { FieldError, ValidationResult } from '../errors';
import type { DraftStatus, DraftType } from '../enums';
import { DRAFT_STATUSES, DRAFT_TYPES } from '../enums';
import type { ValidationContext } from './context';
import { parseStorageTimestamp } from './dates';
import { asRecord, charCount, readNumber, readString } from './fields';
import { invalid, localeOf } from './messages';
import { fail, ok } from './result';

/** Legal draft validation (AGENTS.md §5). */

export const FORM_DATA_MAX = 5000;
export const GENERATED_TEXT_MAX = 20000;

export interface LegalDraftInput {
  citizen_id: number;
  draft_type: DraftType;
  form_data: string;
  generated_text: string;
  status: DraftStatus;
  version: number;
  created_at: string;
}

function isDraftType(value: string): value is DraftType {
  return (DRAFT_TYPES as readonly string[]).includes(value);
}

function isDraftStatus(value: string): value is DraftStatus {
  return (DRAFT_STATUSES as readonly string[]).includes(value);
}

export async function validateLegalDraftInput(
  input: unknown,
  context: ValidationContext,
): Promise<ValidationResult<LegalDraftInput>> {
  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const errors: FieldError[] = [];

  const output: LegalDraftInput = {
    citizen_id: 0,
    draft_type: 'Complaint',
    form_data: '',
    generated_text: '',
    status: 'Pending Review',
    version: 1,
    created_at: context.clock.nowIso(),
  };

  const citizenId = readNumber(record, 'citizen_id');
  if (citizenId.status === 'missing') {
    errors.push(invalid('citizen_id', 'REQUIRED', locale, 'required'));
  } else if (citizenId.status === 'invalid' || !Number.isInteger(citizenId.value)) {
    errors.push(invalid('citizen_id', 'TYPE', locale, 'invalidType'));
  } else if (!(await context.exists('Citizen', citizenId.value))) {
    errors.push(invalid('citizen_id', 'FK_NOT_FOUND', locale, 'citizenNotFound'));
  } else {
    output.citizen_id = citizenId.value;
  }

  const draftType = readString(record, 'draft_type');
  if (draftType.status === 'missing') {
    errors.push(invalid('draft_type', 'REQUIRED', locale, 'required'));
  } else if (draftType.status === 'invalid') {
    errors.push(invalid('draft_type', 'TYPE', locale, 'invalidType'));
  } else if (!isDraftType(draftType.value)) {
    errors.push(invalid('draft_type', 'ENUM', locale, 'invalidEnum', { allowed: DRAFT_TYPES.join(', ') }));
  } else {
    output.draft_type = draftType.value;
  }

  const formData = readString(record, 'form_data');
  if (formData.status === 'missing') {
    errors.push(invalid('form_data', 'REQUIRED', locale, 'required'));
  } else if (formData.status === 'invalid') {
    errors.push(invalid('form_data', 'TYPE', locale, 'invalidType'));
  } else if (charCount(formData.value) > FORM_DATA_MAX) {
    errors.push(invalid('form_data', 'LENGTH', locale, 'tooLong', { max: FORM_DATA_MAX }));
  } else {
    output.form_data = formData.value;
  }

  const generatedText = readString(record, 'generated_text');
  if (generatedText.status === 'missing') {
    errors.push(invalid('generated_text', 'REQUIRED', locale, 'required'));
  } else if (generatedText.status === 'invalid') {
    errors.push(invalid('generated_text', 'TYPE', locale, 'invalidType'));
  } else if (charCount(generatedText.value) > GENERATED_TEXT_MAX) {
    errors.push(invalid('generated_text', 'LENGTH', locale, 'tooLong', { max: GENERATED_TEXT_MAX }));
  } else {
    output.generated_text = generatedText.value;
  }

  const status = readString(record, 'status');
  if (status.status === 'missing') {
    errors.push(invalid('status', 'REQUIRED', locale, 'required'));
  } else if (status.status === 'invalid') {
    errors.push(invalid('status', 'TYPE', locale, 'invalidType'));
  } else if (!isDraftStatus(status.value)) {
    errors.push(invalid('status', 'ENUM', locale, 'invalidEnum', { allowed: DRAFT_STATUSES.join(', ') }));
  } else {
    output.status = status.value;
  }

  // Version is system-managed and starts at 1; clients never choose it.
  const version = readNumber(record, 'version');
  if (version.status === 'invalid' || (version.status === 'ok' && !Number.isInteger(version.value))) {
    errors.push(invalid('version', 'TYPE', locale, 'invalidType'));
  } else if (version.status === 'ok' && version.value < 1) {
    errors.push(invalid('version', 'FORMAT', locale, 'versionFormat'));
  } else if (version.status === 'ok') {
    output.version = version.value;
  }

  const createdAt = readString(record, 'created_at');
  if (createdAt.status === 'invalid') {
    errors.push(invalid('created_at', 'TYPE', locale, 'invalidType'));
  } else if (createdAt.status === 'ok') {
    const parsed = parseStorageTimestamp(createdAt.value);
    if (!parsed) {
      errors.push(invalid('created_at', 'INVALID_DATE', locale, 'invalidDate'));
    } else if (parsed.getTime() > context.clock.now().getTime()) {
      errors.push(invalid('created_at', 'FUTURE_DATE', locale, 'futureDate'));
    } else {
      output.created_at = createdAt.value;
    }
  }

  return errors.length > 0 ? fail(errors) : ok(output);
}
