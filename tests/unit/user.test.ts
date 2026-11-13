import { describe, expect, it } from 'vitest';

import type { ValidationCode, ValidationResult } from '../../src/shared/errors';
import { validateUserInput, type UserInput } from '../../src/shared/validation';
import { createValidationContext, withoutField } from '../helpers/validation';

const baseUser: Record<string, unknown> = {
  name: 'Ramesh Sharma',
  email: 'ramesh.sharma@lawtrack.in',
  phone_number: '9876543210',
  password: 'Legal1234',
  role: 'Citizen',
  language: 'English',
};

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...baseUser, ...overrides };
}

function firstIssue(result: ValidationResult<unknown>, field: string): ValidationCode | undefined {
  return result.ok ? undefined : result.errors.find((error) => error.field === field)?.code;
}

function expectIssue(result: ValidationResult<unknown>, field: string, code: ValidationCode): void {
  expect(result.ok, `expected ${field} to fail with ${code}`).toBe(false);
  expect(firstIssue(result, field), JSON.stringify(result)).toBe(code);
}

function expectValue(result: ValidationResult<UserInput>): UserInput {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  return result.value;
}

describe('User validation (UT_USR)', () => {
  const context = createValidationContext();

  it('UT_USR_01 name accepts Ramesh Sharma', async () => {
    const result = await validateUserInput(input({ name: 'Ramesh Sharma' }), context);
    expect(expectValue(result).name).toBe('Ramesh Sharma');
  });

  it('UT_USR_02 name rejects Ramesh123 with FORMAT', async () => {
    expectIssue(await validateUserInput(input({ name: 'Ramesh123' }), context), 'name', 'FORMAT');
  });

  it('UT_USR_03 name rejects an empty value with REQUIRED', async () => {
    expectIssue(await validateUserInput(input({ name: '' }), context), 'name', 'REQUIRED');
  });

  it('UT_USR_04 email accepts ramesh@lawtrack.in', async () => {
    const result = await validateUserInput(input({ email: 'ramesh@lawtrack.in' }), context);
    expect(expectValue(result).email).toBe('ramesh@lawtrack.in');
  });

  it('UT_USR_05 email rejects ramesh.lawtrack.in with FORMAT', async () => {
    expectIssue(
      await validateUserInput(input({ email: 'ramesh.lawtrack.in' }), context),
      'email',
      'FORMAT',
    );
  });

  it('UT_USR_06 email rejects ramesh@lawtrack.in when already registered with UNIQUE', async () => {
    const registered = createValidationContext({ emails: ['ramesh@lawtrack.in'] });
    expectIssue(
      await validateUserInput(input({ email: 'ramesh@lawtrack.in' }), registered),
      'email',
      'UNIQUE',
    );
  });

  it('UT_USR_07 phone accepts 9876543210', async () => {
    expect(
      expectValue(await validateUserInput(input({ phone_number: '9876543210' }), context)).phone_number,
    ).toBe('9876543210');
  });

  it('UT_USR_08 phone rejects 5876543210 with FORMAT', async () => {
    expectIssue(
      await validateUserInput(input({ phone_number: '5876543210' }), context),
      'phone_number',
      'FORMAT',
    );
  });

  it('UT_USR_09 phone rejects 98765abcde with FORMAT', async () => {
    expectIssue(
      await validateUserInput(input({ phone_number: '98765abcde' }), context),
      'phone_number',
      'FORMAT',
    );
  });

  it('UT_USR_10 password accepts Legal1234', async () => {
    expect(expectValue(await validateUserInput(input({ password: 'Legal1234' }), context)).password).toBe(
      'Legal1234',
    );
  });

  it('UT_USR_11 password rejects Ab1 with LENGTH', async () => {
    expectIssue(await validateUserInput(input({ password: 'Ab1' }), context), 'password', 'LENGTH');
  });

  it('UT_USR_12 password rejects abcdefgh with FORMAT', async () => {
    expectIssue(await validateUserInput(input({ password: 'abcdefgh' }), context), 'password', 'FORMAT');
  });

  it('UT_USR_13 role accepts Citizen', async () => {
    expect(expectValue(await validateUserInput(input({ role: 'Citizen' }), context)).role).toBe('Citizen');
  });

  it('UT_USR_14 role rejects a blank value with REQUIRED', async () => {
    expectIssue(await validateUserInput(input({ role: '' }), context), 'role', 'REQUIRED');
  });

  it('UT_USR_15 role rejects Judge with ENUM', async () => {
    expectIssue(await validateUserInput(input({ role: 'Judge' }), context), 'role', 'ENUM');
  });

  it('UT_USR_16 language accepts Hindi', async () => {
    expect(expectValue(await validateUserInput(input({ language: 'Hindi' }), context)).language).toBe(
      'Hindi',
    );
  });

  it('UT_USR_17 language rejects a blank value with REQUIRED', async () => {
    expectIssue(await validateUserInput(input({ language: '' }), context), 'language', 'REQUIRED');
  });

  it('UT_USR_18 language rejects French with ENUM', async () => {
    expectIssue(await validateUserInput(input({ language: 'French' }), context), 'language', 'ENUM');
  });

  it('UT_USR_19 is_verified accepts a boolean in system context', async () => {
    expect(expectValue(await validateUserInput(input({ is_verified: true }), context)).is_verified).toBe(
      true,
    );
  });

  it('UT_USR_20 is_verified rejects the string "yes" with TYPE', async () => {
    expectIssue(await validateUserInput(input({ is_verified: 'yes' }), context), 'is_verified', 'TYPE');
  });

  it('UT_USR_21 is_verified rejects an explicit null with TYPE', async () => {
    expectIssue(await validateUserInput(input({ is_verified: null }), context), 'is_verified', 'TYPE');
  });

  it('UT_USR_25 name rejects a 1-character value with LENGTH', async () => {
    expectIssue(await validateUserInput(input({ name: 'R' }), context), 'name', 'LENGTH');
  });

  it('UT_USR_26 name accepts a 2-character value', async () => {
    expect(expectValue(await validateUserInput(input({ name: 'Jo' }), context)).name).toBe('Jo');
  });

  it('UT_USR_27 name accepts exactly 100 characters', async () => {
    expect(
      expectValue(await validateUserInput(input({ name: 'a'.repeat(100) }), context)).name,
    ).toHaveLength(100);
  });

  it('UT_USR_28 name rejects 101 characters with LENGTH', async () => {
    expectIssue(await validateUserInput(input({ name: 'a'.repeat(101) }), context), 'name', 'LENGTH');
  });

  it("UT_USR_29 name accepts D'Souza", async () => {
    expect(expectValue(await validateUserInput(input({ name: "D'Souza" }), context)).name).toBe("D'Souza");
  });

  it('UT_USR_30 name accepts Devanagari आरती शर्मा', async () => {
    expect(expectValue(await validateUserInput(input({ name: 'आरती शर्मा' }), context)).name).toBe(
      'आरती शर्मा',
    );
  });

  it('UT_USR_31 email accepts exactly 120 characters', async () => {
    const email = `${'a'.repeat(108)}@lawtrack.in`;
    expect(email).toHaveLength(120);
    expect(expectValue(await validateUserInput(input({ email }), context)).email).toBe(email);
  });

  it('UT_USR_32 email rejects 121 characters with LENGTH', async () => {
    const email = `${'a'.repeat(109)}@lawtrack.in`;
    expectIssue(await validateUserInput(input({ email }), context), 'email', 'LENGTH');
  });

  it('UT_USR_33 email uniqueness is case-insensitive', async () => {
    const registered = createValidationContext({ emails: ['ramesh@lawtrack.in'] });
    expectIssue(
      await validateUserInput(input({ email: 'RAMESH@LAWTRACK.IN' }), registered),
      'email',
      'UNIQUE',
    );
  });

  it('UT_USR_34 phone rejects 9 digits with FORMAT', async () => {
    expectIssue(
      await validateUserInput(input({ phone_number: '987654321' }), context),
      'phone_number',
      'FORMAT',
    );
  });

  it('UT_USR_35 phone rejects 11 digits with FORMAT', async () => {
    expectIssue(
      await validateUserInput(input({ phone_number: '98765432101' }), context),
      'phone_number',
      'FORMAT',
    );
  });

  it('UT_USR_36 phone normalises +919876543210 to 10 digits', async () => {
    const value = expectValue(await validateUserInput(input({ phone_number: '+919876543210' }), context));
    expect(value.phone_number).toBe('9876543210');
  });

  it('UT_USR_37 password rejects 7 characters with LENGTH', async () => {
    expectIssue(await validateUserInput(input({ password: 'Legal12' }), context), 'password', 'LENGTH');
  });

  it('UT_USR_38 password accepts exactly 8 characters', async () => {
    expect(expectValue(await validateUserInput(input({ password: 'Legal123' }), context)).password).toBe(
      'Legal123',
    );
  });

  it('UT_USR_39 password rejects 65 characters with LENGTH', async () => {
    expectIssue(
      await validateUserInput(input({ password: `A1${'a'.repeat(63)}` }), context),
      'password',
      'LENGTH',
    );
  });

  it('UT_USR_40 password rejects a space with FORMAT', async () => {
    expectIssue(await validateUserInput(input({ password: 'Legal 1234' }), context), 'password', 'FORMAT');
  });

  it('UT_USR_41 password rejects a symbol with FORMAT', async () => {
    expectIssue(await validateUserInput(input({ password: 'Legal@1234' }), context), 'password', 'FORMAT');
  });

  it('UT_USR_42 is_verified defaults to false when omitted', async () => {
    expect(expectValue(await validateUserInput(input(), context)).is_verified).toBe(false);
  });

  it('UT_USR_43 public registration refuses a non-citizen role', async () => {
    expectIssue(await validateUserInput(input({ role: 'Lawyer' }), context), 'role', 'FORMAT');
  });

  it('UT_USR_44 admin-created accounts may use any role', async () => {
    const value = expectValue(
      await validateUserInput(input({ role: 'Lawyer' }), context, { allowAnyRole: true }),
    );
    expect(value.role).toBe('Lawyer');
  });

  it('UT_USR_45 messages are localised in Hindi', async () => {
    const hindi = createValidationContext({ locale: 'hi' });
    const result = await validateUserInput(withoutField(input(), 'name'), hindi);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.field).toBe('name');
    expect(result.errors[0]?.message).toContain('नाम');
  });
});
