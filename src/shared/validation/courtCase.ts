import type { FieldError, ValidationResult } from '../errors';
import type { CaseStatus } from '../enums';
import { CASE_STATUSES } from '../enums';
import type { Locale } from '../../i18n';
import type { ValidationContext } from './context';
import { isRealDate, parseStorageTimestamp } from './dates';
import { asRecord, charCount, readNumber, readString } from './fields';
import { invalid, invalidLabel, fieldLabel, localeOf } from './messages';
import { fail, ok } from './result';

/** Court case validation (AGENTS.md §5). */

export const CASE_TITLE_MAX = 200;
export const COURT_NAME_MAX = 120;

/**
 * `manual` is the default for curator/admin edits: a pending case must carry a
 * today-or-later hearing date. `sync` accepts stale or missing dates coming
 * from eCourts and surfaces them as "awaiting update" in the UI.
 */
export type CourtCaseSource = 'manual' | 'sync';

export interface CourtCaseValidationOptions {
  source?: CourtCaseSource;
}

export interface CourtCaseInput {
  integration_id: number;
  cnr_number: string;
  case_title: string;
  court_name: string;
  status: CaseStatus;
  next_hearing_date: string | null;
  last_synced_at: string;
}

const CNR_PATTERN = /^[A-Z]{4}\d{12}$/;

function isCaseStatus(value: string): value is CaseStatus {
  return (CASE_STATUSES as readonly string[]).includes(value);
}

/** Normalise (trim + uppercase) and validate the public CNR format. */
export function normalizeCnr(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return CNR_PATTERN.test(normalized) ? normalized : null;
}

export interface CnrLookupInput {
  cnr: string;
}

/**
 * CNR-only validation for the tracker's lookup box (AGENTS.md §6, §17).
 *
 * It runs before any adapter call, so a malformed CNR is rejected locally with
 * zero upstream requests. The request field is `cnr` (the API body documented in
 * §7); `cnr_number` is accepted as an alias because that is the column name.
 * The same function feeds the client-side format hint.
 */
export function validateCnrLookup(
  input: unknown,
  locale: Locale = 'en',
): ValidationResult<CnrLookupInput> {
  const record = asRecord(input);
  const errors: FieldError[] = [];
  const source = 'cnr' in record ? 'cnr' : 'cnr_number';
  const cnr = readString(record, source);

  if (cnr.status === 'missing') {
    errors.push(invalidLabel('cnr', fieldLabel('cnr_number', locale), 'REQUIRED', locale, 'required'));
  } else if (cnr.status === 'invalid') {
    errors.push(invalidLabel('cnr', fieldLabel('cnr_number', locale), 'TYPE', locale, 'invalidType'));
  } else {
    const normalized = normalizeCnr(cnr.value);
    if (!normalized) {
      errors.push(invalidLabel('cnr', fieldLabel('cnr_number', locale), 'FORMAT', locale, 'cnrFormat'));
    } else {
      return ok({ cnr: normalized });
    }
  }

  return fail(errors);
}

export async function validateCourtCaseInput(
  input: unknown,
  context: ValidationContext,
  options: CourtCaseValidationOptions = {},
): Promise<ValidationResult<CourtCaseInput>> {
  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const source = options.source ?? 'manual';
  const errors: FieldError[] = [];

  const output: CourtCaseInput = {
    integration_id: 0,
    cnr_number: '',
    case_title: '',
    court_name: '',
    status: 'Pending',
    next_hearing_date: null,
    last_synced_at: context.clock.nowIso(),
  };

  const integrationId = readNumber(record, 'integration_id');
  if (integrationId.status === 'missing') {
    errors.push(invalid('integration_id', 'REQUIRED', locale, 'required'));
  } else if (integrationId.status === 'invalid' || !Number.isInteger(integrationId.value)) {
    errors.push(invalid('integration_id', 'TYPE', locale, 'invalidType'));
  } else if (!(await context.exists('API_Integration', integrationId.value))) {
    errors.push(invalid('integration_id', 'FK_NOT_FOUND', locale, 'integrationNotFound'));
  } else {
    output.integration_id = integrationId.value;
  }

  const cnr = readString(record, 'cnr_number');
  if (cnr.status === 'missing') {
    errors.push(invalid('cnr_number', 'REQUIRED', locale, 'required'));
  } else if (cnr.status === 'invalid') {
    errors.push(invalid('cnr_number', 'TYPE', locale, 'invalidType'));
  } else {
    const normalized = normalizeCnr(cnr.value);
    if (!normalized) {
      errors.push(invalid('cnr_number', 'FORMAT', locale, 'cnrFormat'));
    } else if (!(await context.isUnique('cnr_number', normalized))) {
      errors.push(invalid('cnr_number', 'UNIQUE', locale, 'cnrUnique'));
    } else {
      output.cnr_number = normalized;
    }
  }

  const caseTitle = readString(record, 'case_title');
  if (caseTitle.status === 'missing') {
    errors.push(invalid('case_title', 'REQUIRED', locale, 'required'));
  } else if (caseTitle.status === 'invalid') {
    errors.push(invalid('case_title', 'TYPE', locale, 'invalidType'));
  } else if (charCount(caseTitle.value) > CASE_TITLE_MAX) {
    errors.push(invalid('case_title', 'LENGTH', locale, 'tooLong', { max: CASE_TITLE_MAX }));
  } else {
    output.case_title = caseTitle.value;
  }

  const courtName = readString(record, 'court_name');
  if (courtName.status === 'missing') {
    errors.push(invalid('court_name', 'REQUIRED', locale, 'required'));
  } else if (courtName.status === 'invalid') {
    errors.push(invalid('court_name', 'TYPE', locale, 'invalidType'));
  } else if (charCount(courtName.value) > COURT_NAME_MAX) {
    errors.push(invalid('court_name', 'LENGTH', locale, 'tooLong', { max: COURT_NAME_MAX }));
  } else {
    output.court_name = courtName.value;
  }

  const status = readString(record, 'status');
  if (status.status === 'missing') {
    errors.push(invalid('status', 'REQUIRED', locale, 'required'));
  } else if (status.status === 'invalid') {
    errors.push(invalid('status', 'TYPE', locale, 'invalidType'));
  } else if (!isCaseStatus(status.value)) {
    errors.push(invalid('status', 'ENUM', locale, 'invalidEnum', { allowed: CASE_STATUSES.join(', ') }));
  } else {
    output.status = status.value;
  }

  const hearingDate = readString(record, 'next_hearing_date');
  if (hearingDate.status === 'invalid') {
    errors.push(invalid('next_hearing_date', 'INVALID_DATE', locale, 'invalidDate'));
  } else if (hearingDate.status === 'ok') {
    if (!isRealDate(hearingDate.value)) {
      errors.push(invalid('next_hearing_date', 'INVALID_DATE', locale, 'invalidDate'));
    } else if (
      source === 'manual' &&
      output.status === 'Pending' &&
      hearingDate.value < context.clock.today()
    ) {
      errors.push(invalid('next_hearing_date', 'PAST_DATE', locale, 'pastDate'));
    } else {
      output.next_hearing_date = hearingDate.value;
    }
  } else if (source === 'manual' && output.status === 'Pending') {
    errors.push(invalid('next_hearing_date', 'REQUIRED', locale, 'required'));
  }

  const syncedAt = readString(record, 'last_synced_at');
  if (syncedAt.status === 'invalid') {
    errors.push(invalid('last_synced_at', 'TYPE', locale, 'invalidType'));
  } else if (syncedAt.status === 'ok') {
    const parsed = parseStorageTimestamp(syncedAt.value);
    if (!parsed) {
      errors.push(invalid('last_synced_at', 'INVALID_DATE', locale, 'invalidDate'));
    } else if (parsed.getTime() > context.clock.now().getTime()) {
      errors.push(invalid('last_synced_at', 'FUTURE_DATE', locale, 'futureDate'));
    } else {
      output.last_synced_at = syncedAt.value;
    }
  }

  return errors.length > 0 ? fail(errors) : ok(output);
}
