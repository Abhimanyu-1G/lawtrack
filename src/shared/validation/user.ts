import type { FieldError, ValidationResult } from '../errors';
import type { UserRole, Language } from '../enums';
import { LANGUAGES, USER_ROLES } from '../enums';
import type { ValidationContext } from './context';
import { asRecord, charCount, readString, type StringRead } from './fields';
import { invalid, localeOf } from './messages';
import { fail, ok } from './result';

/**
 * User, registration and profile validation (AGENTS.md §5).
 *
 * `is_verified` is system-controlled: omitting it yields `false`, while an
 * explicit non-boolean (including `null`) is a TYPE error.
 */

export interface UserInput {
  name: string;
  email: string;
  phone_number: string | null;
  /** Present for registration and admin-created accounts; never persisted. */
  password?: string;
  role: UserRole;
  language: Language;
  is_verified: boolean;
}

export interface UserValidationOptions {
  /** Admins may create any role; public registration is citizens only. */
  allowAnyRole?: boolean;
}

/** Fields a signed-in user may change on their own profile. */
export interface ProfileInput {
  name?: string;
  phone_number?: string | null;
  language?: Language;
}

const NAME_PATTERN = /^[\p{L}\p{M} .'-]+$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN = 2;
const NAME_MAX = 100;
const EMAIL_MAX = 120;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;

function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

/** Strip an optional +91 / 91 prefix; return the 10-digit national number. */
export function normalizePhoneNumber(value: string): string | null {
  let digits = value.trim();
  if (digits.startsWith('+91')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

interface Checked<T> {
  value?: T;
  error?: FieldError;
}

function checkName(raw: StringRead, locale: ReturnType<typeof localeOf>): Checked<string> {
  if (raw.status === 'missing') return { error: invalid('name', 'REQUIRED', locale, 'required') };
  if (raw.status === 'invalid') return { error: invalid('name', 'TYPE', locale, 'invalidType') };

  const length = charCount(raw.value);
  if (length < NAME_MIN || length > NAME_MAX) {
    return {
      error: invalid('name', 'LENGTH', locale, 'between', { min: NAME_MIN, max: NAME_MAX }),
    };
  }
  if (!NAME_PATTERN.test(raw.value)) {
    return { error: invalid('name', 'FORMAT', locale, 'nameFormat') };
  }
  return { value: raw.value };
}

function checkPassword(raw: StringRead, locale: ReturnType<typeof localeOf>): Checked<string> {
  if (raw.status === 'missing') return { error: invalid('password', 'REQUIRED', locale, 'required') };
  if (raw.status === 'invalid') return { error: invalid('password', 'TYPE', locale, 'invalidType') };

  const length = raw.value.length;
  if (length < PASSWORD_MIN || length > PASSWORD_MAX) {
    return {
      error: invalid('password', 'LENGTH', locale, 'passwordRange', {
        min: PASSWORD_MIN,
        max: PASSWORD_MAX,
      }),
    };
  }
  if (!/^[A-Za-z0-9]+$/.test(raw.value) || !/[A-Za-z]/.test(raw.value) || !/\d/.test(raw.value)) {
    return { error: invalid('password', 'FORMAT', locale, 'passwordFormat') };
  }
  return { value: raw.value };
}

function checkPhone(raw: StringRead, locale: ReturnType<typeof localeOf>): Checked<string> {
  if (raw.status !== 'ok') return {};
  const normalized = normalizePhoneNumber(raw.value);
  if (!normalized) {
    return { error: invalid('phone_number', 'FORMAT', locale, 'phoneFormat') };
  }
  return { value: normalized };
}

function checkLanguage(raw: StringRead, locale: ReturnType<typeof localeOf>): Checked<Language> {
  if (raw.status === 'missing') return { error: invalid('language', 'REQUIRED', locale, 'required') };
  if (raw.status === 'invalid') return { error: invalid('language', 'TYPE', locale, 'invalidType') };
  if (!isLanguage(raw.value)) {
    return {
      error: invalid('language', 'ENUM', locale, 'invalidEnum', { allowed: LANGUAGES.join(', ') }),
    };
  }
  return { value: raw.value };
}

export async function validateUserInput(
  input: unknown,
  context: ValidationContext,
  options: UserValidationOptions = {},
): Promise<ValidationResult<UserInput>> {
  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const errors: FieldError[] = [];

  const output: UserInput = {
    name: '',
    email: '',
    phone_number: null,
    role: 'Citizen',
    language: 'English',
    is_verified: false,
  };

  const name = checkName(readString(record, 'name'), locale);
  if (name.error) errors.push(name.error);
  else if (name.value !== undefined) output.name = name.value;

  const email = readString(record, 'email');
  if (email.status === 'missing') {
    errors.push(invalid('email', 'REQUIRED', locale, 'required'));
  } else if (email.status === 'invalid') {
    errors.push(invalid('email', 'TYPE', locale, 'invalidType'));
  } else if (charCount(email.value) > EMAIL_MAX) {
    errors.push(invalid('email', 'LENGTH', locale, 'tooLong', { max: EMAIL_MAX }));
  } else if (!EMAIL_PATTERN.test(email.value)) {
    errors.push(invalid('email', 'FORMAT', locale, 'emailFormat'));
  } else {
    const normalized = email.value.toLowerCase();
    // Uniqueness is checked last so a malformed address reports FORMAT first.
    if (!(await context.isUnique('email', normalized))) {
      errors.push(invalid('email', 'UNIQUE', locale, 'emailUnique'));
    } else {
      output.email = normalized;
    }
  }

  // Phone is optional: absent/null becomes null, never an error.
  const phone = readString(record, 'phone_number');
  if (phone.status === 'invalid') {
    errors.push(invalid('phone_number', 'TYPE', locale, 'invalidType'));
  } else {
    const checked = checkPhone(phone, locale);
    if (checked.error) errors.push(checked.error);
    else if (checked.value !== undefined) output.phone_number = checked.value;
  }

  const password = checkPassword(readString(record, 'password'), locale);
  if (password.error) errors.push(password.error);
  else if (password.value !== undefined) output.password = password.value;

  const role = readString(record, 'role');
  if (role.status === 'missing') {
    errors.push(invalid('role', 'REQUIRED', locale, 'required'));
  } else if (role.status === 'invalid') {
    errors.push(invalid('role', 'TYPE', locale, 'invalidType'));
  } else if (!isUserRole(role.value)) {
    errors.push(invalid('role', 'ENUM', locale, 'invalidEnum', { allowed: USER_ROLES.join(', ') }));
  } else if (!options.allowAnyRole && role.value !== 'Citizen') {
    errors.push(invalid('role', 'FORMAT', locale, 'roleCitizenOnly'));
  } else {
    output.role = role.value;
  }

  const language = checkLanguage(readString(record, 'language'), locale);
  if (language.error) errors.push(language.error);
  else if (language.value !== undefined) output.language = language.value;

  const verified = record.is_verified;
  if (verified === undefined) {
    output.is_verified = false;
  } else if (typeof verified !== 'boolean') {
    errors.push(invalid('is_verified', 'TYPE', locale, 'invalidType'));
  } else {
    output.is_verified = verified;
  }

  return errors.length > 0 ? fail(errors) : ok(output);
}

/**
 * PATCH /auth/profile. Every field is optional; omitted fields are unchanged,
 * `phone_number: null` clears it, and an explicit blank name/language fails.
 */
export async function validateProfileInput(
  input: unknown,
  context: ValidationContext,
): Promise<ValidationResult<ProfileInput>> {
  const record = asRecord(input);
  const locale = localeOf(context.locale);
  const errors: FieldError[] = [];
  const output: ProfileInput = {};

  if (record.name !== undefined) {
    const name = checkName(readString(record, 'name'), locale);
    if (name.error) errors.push(name.error);
    else if (name.value !== undefined) output.name = name.value;
  }

  if (record.phone_number !== undefined) {
    if (record.phone_number === null) {
      output.phone_number = null;
    } else {
      const phone = readString(record, 'phone_number');
      if (phone.status === 'invalid') {
        errors.push(invalid('phone_number', 'TYPE', locale, 'invalidType'));
      } else if (phone.status === 'missing') {
        output.phone_number = null;
      } else {
        const checked = checkPhone(phone, locale);
        if (checked.error) errors.push(checked.error);
        else if (checked.value !== undefined) output.phone_number = checked.value;
      }
    }
  }

  if (record.language !== undefined) {
    const language = checkLanguage(readString(record, 'language'), locale);
    if (language.error) errors.push(language.error);
    else if (language.value !== undefined) output.language = language.value;
  }

  return errors.length > 0 ? fail(errors) : ok(output);
}
