import type { FieldError, ValidationResult } from '../errors';
import type { AdminLevel, Language, UserRole } from '../enums';
import { ADMIN_LEVELS, LANGUAGES, USER_ROLES } from '../enums';
import type { ValidationContext } from './context';
import { asRecord, charCount, readNumber, readString } from './fields';
import { invalid, localeOf } from './messages';
import { fail, ok } from './result';
import { validateUserInput, type UserInput } from './user';

/**
 * Administrator user management (AGENTS.md §3, §7).
 *
 * Creation reuses the public user rules with `allowAnyRole`, then validates the
 * role-specific profile the ER model requires (a lawyer needs a bar council id,
 * an administrator an admin level, and so on). Updates deliberately do not
 * accept `is_verified`: only OTP verification sets that flag (AGENTS.md §5).
 */

export const BAR_COUNCIL_MIN = 3;
export const BAR_COUNCIL_MAX = 30;
export const SPECIALIZATION_MAX = 60;
export const EXPERIENCE_MAX = 60;
export const MANAGED_SERVICES_MAX = 120;
export const ADDRESS_MAX = 255;
export const STATE_MAX = 50;

const BAR_COUNCIL_PATTERN = /^[A-Za-z0-9/.-]+$/;

export interface AdminUserInput extends UserInput {
  bar_council_id?: string;
  specialization?: string;
  experience_years?: number;
  managed_services?: string;
  admin_level?: AdminLevel;
  address?: string;
  state?: string;
}

export interface AdminUserUpdateInput {
  role?: UserRole;
  language?: Language;
  /** Required when changing an account to the Lawyer role. */
  bar_council_id?: string;
}

function checkOptionalText(
  value: string | undefined,
  field: 'specialization' | 'managed_services' | 'address' | 'state',
  max: number,
  locale: ReturnType<typeof localeOf>,
): FieldError | undefined {
  if (value === undefined) return undefined;
  if (charCount(value) > max) {
    return invalid(field, 'LENGTH', locale, 'tooLong', { max });
  }
  return undefined;
}

export async function validateAdminUserInput(
  input: unknown,
  context: ValidationContext,
): Promise<ValidationResult<AdminUserInput>> {
  const base = await validateUserInput(input, context, { allowAnyRole: true });
  if (!base.ok) return base;

  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const errors: FieldError[] = [];
  const output: AdminUserInput = { ...base.value };

  if (base.value.role === 'Lawyer') {
    const barCouncil = readString(record, 'bar_council_id');
    if (barCouncil.status === 'missing') {
      errors.push(invalid('bar_council_id', 'REQUIRED', locale, 'required'));
    } else if (barCouncil.status === 'invalid') {
      errors.push(invalid('bar_council_id', 'TYPE', locale, 'invalidType'));
    } else if (
      charCount(barCouncil.value) < BAR_COUNCIL_MIN ||
      charCount(barCouncil.value) > BAR_COUNCIL_MAX
    ) {
      errors.push(
        invalid('bar_council_id', 'LENGTH', locale, 'between', {
          min: BAR_COUNCIL_MIN,
          max: BAR_COUNCIL_MAX,
        }),
      );
    } else if (!BAR_COUNCIL_PATTERN.test(barCouncil.value)) {
      errors.push(invalid('bar_council_id', 'FORMAT', locale, 'barCouncilFormat'));
    } else {
      output.bar_council_id = barCouncil.value;
    }

    const specialization = readString(record, 'specialization');
    if (specialization.status === 'invalid') {
      errors.push(invalid('specialization', 'TYPE', locale, 'invalidType'));
    } else if (specialization.status === 'ok') {
      const problem = checkOptionalText(specialization.value, 'specialization', SPECIALIZATION_MAX, locale);
      if (problem) errors.push(problem);
      else output.specialization = specialization.value;
    }

    const experience = readNumber(record, 'experience_years');
    if (experience.status === 'invalid') {
      errors.push(invalid('experience_years', 'TYPE', locale, 'invalidType'));
    } else if (experience.status === 'ok') {
      if (!Number.isInteger(experience.value) || experience.value < 0 || experience.value > EXPERIENCE_MAX) {
        errors.push(
          invalid('experience_years', 'FORMAT', locale, 'integerRange', {
            min: 0,
            max: EXPERIENCE_MAX,
          }),
        );
      } else {
        output.experience_years = experience.value;
      }
    }
  }

  if (base.value.role === 'Curator') {
    const expertise = readString(record, 'specialization');
    if (expertise.status === 'invalid') {
      errors.push(invalid('specialization', 'TYPE', locale, 'invalidType'));
    } else if (expertise.status === 'ok') {
      const problem = checkOptionalText(expertise.value, 'specialization', SPECIALIZATION_MAX, locale);
      if (problem) errors.push(problem);
      else output.specialization = expertise.value;
    }
  }

  if (base.value.role === 'API Manager') {
    const managed = readString(record, 'managed_services');
    if (managed.status === 'invalid') {
      errors.push(invalid('managed_services', 'TYPE', locale, 'invalidType'));
    } else if (managed.status === 'ok') {
      const problem = checkOptionalText(managed.value, 'managed_services', MANAGED_SERVICES_MAX, locale);
      if (problem) errors.push(problem);
      else output.managed_services = managed.value;
    }
  }

  if (base.value.role === 'Administrator') {
    const level = readString(record, 'admin_level');
    if (level.status === 'invalid') {
      errors.push(invalid('admin_level', 'TYPE', locale, 'invalidType'));
    } else if (level.status === 'ok') {
      if (!(ADMIN_LEVELS as readonly string[]).includes(level.value)) {
        errors.push(
          invalid('admin_level', 'ENUM', locale, 'invalidEnum', { allowed: ADMIN_LEVELS.join(', ') }),
        );
      } else {
        output.admin_level = level.value as AdminLevel;
      }
    }
  }

  if (base.value.role === 'Citizen') {
    const address = readString(record, 'address');
    if (address.status === 'invalid') {
      errors.push(invalid('address', 'TYPE', locale, 'invalidType'));
    } else if (address.status === 'ok') {
      const problem = checkOptionalText(address.value, 'address', ADDRESS_MAX, locale);
      if (problem) errors.push(problem);
      else output.address = address.value;
    }

    const state = readString(record, 'state');
    if (state.status === 'invalid') {
      errors.push(invalid('state', 'TYPE', locale, 'invalidType'));
    } else if (state.status === 'ok') {
      const problem = checkOptionalText(state.value, 'state', STATE_MAX, locale);
      if (problem) errors.push(problem);
      else output.state = state.value;
    }
  }

  return errors.length > 0 ? fail(errors) : ok(output);
}

export function validateAdminUserUpdate(
  input: unknown,
  context: ValidationContext,
): ValidationResult<AdminUserUpdateInput> {
  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const errors: FieldError[] = [];
  const output: AdminUserUpdateInput = {};

  if (record.role !== undefined) {
    const role = readString(record, 'role');
    if (role.status === 'missing') {
      errors.push(invalid('role', 'REQUIRED', locale, 'required'));
    } else if (role.status === 'invalid') {
      errors.push(invalid('role', 'TYPE', locale, 'invalidType'));
    } else if (!(USER_ROLES as readonly string[]).includes(role.value)) {
      errors.push(invalid('role', 'ENUM', locale, 'invalidEnum', { allowed: USER_ROLES.join(', ') }));
    } else {
      output.role = role.value as UserRole;
    }
  }

  if (record.language !== undefined) {
    const language = readString(record, 'language');
    if (language.status === 'missing') {
      errors.push(invalid('language', 'REQUIRED', locale, 'required'));
    } else if (language.status === 'invalid') {
      errors.push(invalid('language', 'TYPE', locale, 'invalidType'));
    } else if (!(LANGUAGES as readonly string[]).includes(language.value)) {
      errors.push(invalid('language', 'ENUM', locale, 'invalidEnum', { allowed: LANGUAGES.join(', ') }));
    } else {
      output.language = language.value as Language;
    }
  }

  if (output.role === 'Lawyer') {
    const barCouncil = readString(record, 'bar_council_id');
    if (barCouncil.status === 'missing') {
      errors.push(invalid('bar_council_id', 'REQUIRED', locale, 'required'));
    } else if (barCouncil.status === 'invalid') {
      errors.push(invalid('bar_council_id', 'TYPE', locale, 'invalidType'));
    } else if (
      charCount(barCouncil.value) < BAR_COUNCIL_MIN ||
      charCount(barCouncil.value) > BAR_COUNCIL_MAX
    ) {
      errors.push(
        invalid('bar_council_id', 'LENGTH', locale, 'between', {
          min: BAR_COUNCIL_MIN,
          max: BAR_COUNCIL_MAX,
        }),
      );
    } else if (!BAR_COUNCIL_PATTERN.test(barCouncil.value)) {
      errors.push(invalid('bar_council_id', 'FORMAT', locale, 'barCouncilFormat'));
    } else {
      output.bar_council_id = barCouncil.value;
    }
  }

  if (errors.length === 0 && Object.keys(output).length === 0) {
    errors.push(invalid('role', 'REQUIRED', locale, 'atLeastOneField'));
  }

  return errors.length > 0 ? fail(errors) : ok(output);
}
