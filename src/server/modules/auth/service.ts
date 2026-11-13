import 'server-only';

import { createHash, randomInt } from 'node:crypto';

import { addMinutes, type Clock } from '../../lib/clock';
import type { Repositories } from '../../db/repositories';
import type { UserRow } from '../users/repo';
import type { OtpGateway } from '../../adapters/otp';
import type { RateLimiter } from '../../http/rateLimit';
import { createValidationContext } from '../../http/validationContext';
import { AppError, unauthorized, validationFailed } from '../../lib/errors';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../../lib/password';
import type { SessionClaims } from '../../../shared/session';
import type { Language, UserRole } from '../../../shared/enums';
import type { FieldError } from '../../../shared/errors';
import {
  asRecord,
  invalid,
  readString,
  validateProfileInput,
  validateUserInput,
  type ProfileInput,
} from '../../../shared/validation';
import type { Locale } from '../../../i18n';

/**
 * Authentication and account business rules (AGENTS.md §6).
 *
 * Layering: route → this service → repositories → db. The service owns hashing,
 * OTP rules, audit entries and session claim construction; it never touches a
 * Request or Response. Dependencies are injected so unit tests use an in-memory
 * database, a fixed clock and a deterministic OTP generator.
 */

const SYSTEM_ACTOR_EMAIL = 'system@lawtrack.local';
const OTP_PURPOSE = 'verify' as const;

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  phoneNumber: string | null;
  role: UserRole;
  language: Language;
  isVerified: boolean;
}

export interface AuthSession {
  user: PublicUser;
  claims: SessionClaims;
}

export interface RegisteredAccount {
  user: PublicUser;
  delivery: { channel: 'SMS' | 'Email'; destination: string };
}

export interface LoginMeta {
  ip: string;
  locale: Locale;
}

export interface AuthServiceOptions {
  repos: Repositories;
  clock: Clock;
  gateway: OtpGateway;
  loginLimiter: RateLimiter;
  /** Test hook: deterministic 6-digit code. */
  generateOtp?: () => string;
}

export interface AuthService {
  register(input: unknown, locale: Locale): Promise<RegisteredAccount>;
  verifyOtp(input: unknown, locale: Locale): Promise<AuthSession>;
  resendOtp(
    input: unknown,
    locale: Locale,
  ): Promise<{ sent: boolean; expiresAt?: string; retryAfterSeconds?: number }>;
  login(input: unknown, meta: LoginMeta): Promise<AuthSession>;
  me(userId: number): Promise<PublicUser>;
  updateProfile(userId: number, input: unknown, locale: Locale): Promise<PublicUser>;
  sessionClaimsFor(user: UserRow): SessionClaims;
}

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.user_id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phone_number,
    role: user.role,
    language: user.language,
    isVerified: user.is_verified === 1,
  };
}

function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function defaultOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Parse a stored UTC `YYYY-MM-DD HH:MM:SS` value for elapsed-time maths. */
function parseUtc(iso: string): number {
  return Date.parse(`${iso.replace(' ', 'T')}Z`);
}

function secondsSince(iso: string, nowIso: string): number {
  return Math.max(0, Math.round((parseUtc(nowIso) - parseUtc(iso)) / 1000));
}

export function createAuthService(options: AuthServiceOptions): AuthService {
  const { repos, clock, gateway, loginLimiter } = options;
  const generateOtp = options.generateOtp ?? defaultOtp;

  const contextFor = (locale: Locale) => createValidationContext(repos, clock, locale);

  async function audit(action: string, details: unknown): Promise<void> {
    const system = await repos.users.findByEmail(SYSTEM_ACTOR_EMAIL);
    if (!system) return;
    await repos.audit.record({
      performedBy: system.user_id,
      action,
      details,
      timestamp: clock.nowIso(),
    });
  }

  function sessionClaimsFor(user: UserRow): SessionClaims {
    return {
      sub: String(user.user_id),
      role: user.role,
      email: user.email,
      name: user.name,
      language: user.language,
    };
  }

  async function issueOtp(
    user: UserRow,
    locale: Locale,
  ): Promise<{ code: string; expiresAt: string; delivery: RegisteredAccount['delivery'] }> {
    const now = clock.nowIso();
    const expiryMinutes = await repos.settings.getNumber('otp_expiry_minutes', 10);
    const code = generateOtp();
    const expiresAt = clock.timestamp(addMinutes(clock.now(), expiryMinutes));

    await repos.otp.invalidateActive(user.user_id, OTP_PURPOSE, now);
    await repos.otp.create({
      userId: user.user_id,
      codeHash: hashOtp(code),
      purpose: OTP_PURPOSE,
      expiresAt,
      createdAt: now,
    });

    const delivery = await gateway.send({
      userId: user.user_id,
      email: user.email,
      phoneNumber: user.phone_number,
      code,
      purpose: OTP_PURPOSE,
      locale,
      expiryMinutes,
    });

    return { code, expiresAt, delivery };
  }

  return {
    sessionClaimsFor,

    async register(input, locale): Promise<RegisteredAccount> {
      const parsed = await validateUserInput(input, contextFor(locale));
      if (!parsed.ok) throw validationFailed(parsed.errors);

      const value = parsed.value;
      if (value.password === undefined) {
        // validateUserInput always requires it; this is a type-narrowing guard.
        throw validationFailed([invalid('password', 'REQUIRED', locale, 'required')]);
      }

      const passwordHash = await hashPassword(value.password);

      let user: UserRow;
      try {
        user = await repos.users.insert({
          name: value.name,
          email: value.email,
          phoneNumber: value.phone_number,
          passwordHash,
          role: value.role,
          language: value.language,
          isVerified: false,
        });
      } catch (error) {
        if (/UNIQUE/i.test(String(error))) {
          throw validationFailed([invalid('email', 'UNIQUE', locale, 'emailUnique')]);
        }
        throw error;
      }

      await repos.users.insertCitizen(user.user_id, {});
      await audit('USER_REGISTERED', {
        userId: user.user_id,
        email: user.email,
        role: user.role,
      });

      const otp = await issueOtp(user, locale);

      return {
        user: toPublicUser(user),
        delivery: { channel: otp.delivery.channel, destination: otp.delivery.destination },
      };
    },

    async verifyOtp(input, locale): Promise<AuthSession> {
      const record = asRecord(input);
      const email = readString(record, 'email');
      const code = readString(record, 'code');

      const errors: FieldError[] = [];
      if (email.status === 'missing') errors.push(invalid('email', 'REQUIRED', locale, 'required'));
      else if (email.status === 'invalid') errors.push(invalid('email', 'TYPE', locale, 'invalidType'));
      if (code.status === 'missing') errors.push(invalid('code', 'REQUIRED', locale, 'required'));
      else if (code.status !== 'ok' || !/^\d{6}$/.test(code.value)) {
        errors.push(invalid('code', 'FORMAT', locale, 'otpFormat'));
      }
      if (errors.length > 0 || email.status !== 'ok' || code.status !== 'ok') {
        throw validationFailed(errors);
      }

      const user = await repos.users.findByEmail(email.value.toLowerCase());
      if (!user) throw new AppError('OTP_INVALID', 'That code is not valid');

      // Idempotent: a refreshed submit after success simply returns the session.
      if (user.is_verified === 1) {
        return { user: toPublicUser(user), claims: sessionClaimsFor(user) };
      }

      const otp = await repos.otp.findLatestUnconsumed(user.user_id, OTP_PURPOSE);
      if (!otp) throw new AppError('OTP_INVALID', 'That code is not valid');

      if (otp.expires_at <= clock.nowIso()) {
        throw new AppError('OTP_EXPIRED', 'That code has expired. Request a new one.');
      }

      const maxAttempts = await repos.settings.getNumber('otp_max_attempts', 5);
      if (otp.attempts >= maxAttempts) {
        throw new AppError('OTP_ATTEMPTS_EXCEEDED', 'Too many attempts. Request a new code to continue.');
      }

      if (hashOtp(code.value) !== otp.code_hash) {
        await repos.otp.incrementAttempts(otp.otp_id);
        throw new AppError('OTP_INVALID', 'That code is not valid');
      }

      const now = clock.nowIso();
      await repos.otp.consume(otp.otp_id, now);
      await repos.users.setVerified(user.user_id);
      await audit('ACCOUNT_VERIFIED', { userId: user.user_id, email: user.email });

      const verified = (await repos.users.findById(user.user_id)) ?? user;
      return { user: toPublicUser(verified), claims: sessionClaimsFor(verified) };
    },

    async resendOtp(input, locale) {
      const record = asRecord(input);
      const email = readString(record, 'email');
      if (email.status !== 'ok') {
        throw validationFailed([invalid('email', 'REQUIRED', locale, 'required')]);
      }

      const user = await repos.users.findByEmail(email.value.toLowerCase());
      // Privacy: unknown or already-verified accounts get the same neutral answer.
      if (!user || user.is_verified === 1) return { sent: false };

      const now = clock.nowIso();
      const resendSeconds = await repos.settings.getNumber('otp_resend_seconds', 60);
      const latest = await repos.otp.findLatestUnconsumed(user.user_id, OTP_PURPOSE);

      if (latest) {
        const elapsed = secondsSince(latest.created_at, now);
        if (elapsed < resendSeconds) {
          throw new AppError(
            'RATE_LIMITED',
            `Please wait ${resendSeconds - elapsed}s before requesting another code`,
          );
        }
      }

      const otp = await issueOtp(user, locale);
      return {
        sent: true,
        expiresAt: otp.expiresAt,
        retryAfterSeconds: resendSeconds,
      };
    },

    async login(input, meta): Promise<AuthSession> {
      const record = asRecord(input);
      const email = readString(record, 'email');
      const password = readString(record, 'password');

      const errors: FieldError[] = [];
      if (email.status === 'missing') errors.push(invalid('email', 'REQUIRED', meta.locale, 'required'));
      else if (email.status === 'invalid')
        errors.push(invalid('email', 'TYPE', meta.locale, 'invalidType'));
      if (password.status === 'missing')
        errors.push(invalid('password', 'REQUIRED', meta.locale, 'required'));
      if (errors.length > 0 || email.status !== 'ok' || password.status !== 'ok') {
        throw validationFailed(errors);
      }

      const normalizedEmail = email.value.toLowerCase();
      const decision = loginLimiter.check(`${meta.ip}|${normalizedEmail}`);
      if (!decision.allowed) {
        throw new AppError(
          'RATE_LIMITED',
          `Too many attempts. Try again in ${decision.retryAfterSeconds}s.`,
        );
      }

      const user = await repos.users.findByEmail(normalizedEmail);
      const passwordMatches = await verifyPassword(
        password.value,
        user?.password_hash ?? DUMMY_PASSWORD_HASH,
      );

      if (!user || !passwordMatches) {
        throw unauthorized('Invalid email or password');
      }

      if (user.is_verified !== 1) {
        throw new AppError('ACCOUNT_NOT_VERIFIED', 'Account not verified');
      }

      if (user.role === 'Administrator') {
        await repos.users.recordAdminLogin(user.user_id, clock.nowIso());
      }

      return { user: toPublicUser(user), claims: sessionClaimsFor(user) };
    },

    async me(userId): Promise<PublicUser> {
      const user = await repos.users.findById(userId);
      if (!user) throw unauthorized();
      return toPublicUser(user);
    },

    async updateProfile(userId, input, locale): Promise<PublicUser> {
      const parsed = await validateProfileInput(input, contextFor(locale));
      if (!parsed.ok) throw validationFailed(parsed.errors);

      const patch: ProfileInput = parsed.value;
      await repos.users.updateProfile(userId, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phone_number !== undefined ? { phoneNumber: patch.phone_number } : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
      });

      const user = await repos.users.findById(userId);
      if (!user) throw unauthorized();
      return toPublicUser(user);
    },
  };
}
