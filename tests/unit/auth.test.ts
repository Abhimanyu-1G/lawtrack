import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createInMemoryDatabase } from '../../src/server/db/memory';
import type { LawTrackDatabase } from '../../src/server/db/client';
import { createRepositories, type Repositories } from '../../src/server/db/repositories';
import { createAuthService, type AuthService } from '../../src/server/modules/auth/service';
import { createFixedClock } from '../../src/shared/clock';
import { createRateLimiter } from '../../src/server/http/rateLimit';
import { DUMMY_PASSWORD_HASH, isBcryptHash } from '../../src/server/lib/password';
import { AppError } from '../../src/server/lib/errors';
import type { OtpGateway, SendOtpInput } from '../../src/server/adapters/otp';

/**
 * Auth service tests (AGENTS.md §17, UT_USR_22–24 plus OTP extras). No HTTP and
 * no network: an in-memory SQLite database, a fixed clock at noon IST on
 * 2026-11-10 and a recording OTP gateway.
 */

const FIXED_NOW = '2026-11-10 12:00:00';
const clock = createFixedClock(FIXED_NOW);

interface Fixture {
  handle: LawTrackDatabase;
  repos: Repositories;
  service: AuthService;
  sent: SendOtpInput[];
  setCode(code: string): void;
}

let fixture: Fixture;

async function createFixture(): Promise<Fixture> {
  const handle = createInMemoryDatabase();
  const repos = createRepositories(handle);

  const system = await repos.users.insert({
    name: 'LawTrack System',
    email: 'system@lawtrack.local',
    passwordHash: DUMMY_PASSWORD_HASH,
    role: 'Administrator',
    language: 'English',
    isVerified: false,
  });
  await repos.users.insertAdministrator(system.user_id, { adminLevel: 'Super' });
  await repos.settings.set('otp_expiry_minutes', '10');
  await repos.settings.set('otp_max_attempts', '5');
  await repos.settings.set('otp_resend_seconds', '60');

  const sent: SendOtpInput[] = [];
  let code = '123456';

  const gateway: OtpGateway = {
    async send(input: SendOtpInput) {
      sent.push(input);
      return { channel: input.phoneNumber ? 'SMS' : 'Email', destination: 'ra*****@lawtrack.in' };
    },
  };

  const service = createAuthService({
    repos,
    clock,
    gateway,
    loginLimiter: createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000, now: () => 0 }),
    generateOtp: () => code,
  });

  return {
    handle,
    repos,
    service,
    sent,
    setCode(next: string) {
      code = next;
    },
  };
}

function registration(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Ramesh Sharma',
    email: 'ramesh@lawtrack.in',
    phone_number: '9876543210',
    password: 'Legal1234',
    role: 'Citizen',
    language: 'English',
    ...overrides,
  };
}

async function registerAndVerify(email = 'ramesh@lawtrack.in'): Promise<void> {
  await fixture.service.register(registration({ email }), 'en');
  await fixture.service.verifyOtp({ email, code: '123456' }, 'en');
}

beforeEach(async () => {
  fixture = await createFixture();
});

afterEach(async () => {
  await fixture.handle.close();
});

describe('Authentication (UT_USR_22-24)', () => {
  it('UT_USR_22 register stores a bcrypt hash and never the plain password', async () => {
    await fixture.service.register(registration({ password: 'Legal1234' }), 'en');

    const stored = fixture.handle.sqlite
      .prepare('SELECT password_hash FROM User WHERE email = ?')
      .get('ramesh@lawtrack.in') as { password_hash: string };

    expect(stored.password_hash).not.toBe('Legal1234');
    expect(stored.password_hash.includes('Legal1234')).toBe(false);
    expect(isBcryptHash(stored.password_hash)).toBe(true);
    expect(stored.password_hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('UT_USR_23 verifyOTP with the correct code sets is_verified to true', async () => {
    await fixture.service.register(registration(), 'en');
    const session = await fixture.service.verifyOtp({ email: 'ramesh@lawtrack.in', code: '123456' }, 'en');

    expect(session.user.isVerified).toBe(true);
    expect((await fixture.service.me(session.user.id)).isVerified).toBe(true);
  });

  it('UT_USR_24 login rejects an unverified account with Account not verified', async () => {
    await fixture.service.register(registration(), 'en');

    await expect(
      fixture.service.login(
        { email: 'ramesh@lawtrack.in', password: 'Legal1234' },
        { ip: '127.0.0.1', locale: 'en' },
      ),
    ).rejects.toMatchObject({
      name: 'AppError',
      code: 'ACCOUNT_NOT_VERIFIED',
      message: 'Account not verified',
      status: 403,
    });
  });

  it('UT_USR_46 wrong OTP is rejected but a later correct code still works', async () => {
    await fixture.service.register(registration(), 'en');

    await expect(
      fixture.service.verifyOtp({ email: 'ramesh@lawtrack.in', code: '000000' }, 'en'),
    ).rejects.toMatchObject({ code: 'OTP_INVALID' });

    const session = await fixture.service.verifyOtp({ email: 'ramesh@lawtrack.in', code: '123456' }, 'en');
    expect(session.user.isVerified).toBe(true);
  });

  it('UT_USR_47 the sixth wrong OTP attempt reports OTP_ATTEMPTS_EXCEEDED', async () => {
    await fixture.service.register(registration(), 'en');

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(
        fixture.service.verifyOtp({ email: 'ramesh@lawtrack.in', code: '000000' }, 'en'),
      ).rejects.toMatchObject({ code: 'OTP_INVALID' });
    }

    await expect(
      fixture.service.verifyOtp({ email: 'ramesh@lawtrack.in', code: '999999' }, 'en'),
    ).rejects.toMatchObject({ code: 'OTP_ATTEMPTS_EXCEEDED' });

    // Even the correct code is locked out until a resend.
    await expect(
      fixture.service.verifyOtp({ email: 'ramesh@lawtrack.in', code: '123456' }, 'en'),
    ).rejects.toMatchObject({ code: 'OTP_ATTEMPTS_EXCEEDED' });
  });

  it('UT_USR_48 an expired OTP reports OTP_EXPIRED', async () => {
    await fixture.service.register(registration(), 'en');
    fixture.handle.sqlite.prepare('UPDATE Otp_Code SET expires_at = ?').run('2026-11-09 12:00:00');

    await expect(
      fixture.service.verifyOtp({ email: 'ramesh@lawtrack.in', code: '123456' }, 'en'),
    ).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });

  it('UT_USR_49 resend is throttled for 60 seconds after the last code', async () => {
    await fixture.service.register(registration(), 'en');

    await expect(fixture.service.resendOtp({ email: 'ramesh@lawtrack.in' }, 'en')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('UT_USR_50 duplicate email reports UNIQUE on the email field', async () => {
    await fixture.service.register(registration(), 'en');

    await expect(fixture.service.register(registration(), 'en')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: [expect.objectContaining({ field: 'email', code: 'UNIQUE' })],
    });
  });

  it('UT_USR_51 public registration refuses a non-citizen role', async () => {
    await expect(fixture.service.register(registration({ role: 'Lawyer' }), 'en')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: [expect.objectContaining({ field: 'role', code: 'FORMAT' })],
    });
  });

  it('UT_USR_52 wrong password returns the generic Invalid email or password', async () => {
    await registerAndVerify();

    const error = await fixture.service
      .login({ email: 'ramesh@lawtrack.in', password: 'Wrong1234' }, { ip: '127.0.0.1', locale: 'en' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
  });

  it('UT_USR_53 login is rate limited after 10 attempts from the same IP and email', async () => {
    await registerAndVerify();

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await expect(
        fixture.service.login(
          { email: 'ramesh@lawtrack.in', password: 'Wrong1234' },
          { ip: '203.0.113.9', locale: 'en' },
        ),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    }

    await expect(
      fixture.service.login(
        { email: 'ramesh@lawtrack.in', password: 'Legal1234' },
        { ip: '203.0.113.9', locale: 'en' },
      ),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('UT_USR_54 verifying an already-verified account is idempotent', async () => {
    await registerAndVerify();

    const session = await fixture.service.verifyOtp({ email: 'ramesh@lawtrack.in', code: '123456' }, 'en');
    expect(session.user.isVerified).toBe(true);
  });

  it('UT_USR_55 registration and verification write audit entries', async () => {
    await registerAndVerify();
    const audit = await fixture.repos.audit.list({ pageSize: 10 });
    const actions = audit.items.map((row) => row.action);

    expect(actions).toContain('USER_REGISTERED');
    expect(actions).toContain('ACCOUNT_VERIFIED');
  });
});
