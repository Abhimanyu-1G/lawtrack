import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { POST as login } from '../../src/app/api/auth/login/route';
import { POST as logout } from '../../src/app/api/auth/logout/route';
import { GET as me } from '../../src/app/api/auth/me/route';
import { PATCH as updateProfile } from '../../src/app/api/auth/profile/route';
import { POST as register } from '../../src/app/api/auth/register/route';
import { POST as resendOtp } from '../../src/app/api/auth/resend-otp/route';
import { POST as verifyOtp } from '../../src/app/api/auth/verify-otp/route';
import { getDevOtp, resetDevOtps, type DevOtp } from '../../src/server/adapters/otp';
import { closeDb, getDb } from '../../src/server/db/client';
import { runSeed } from '../../src/server/db/seed';
import { loginRateLimiter } from '../../src/server/http/rateLimit';
import { resetAuthService } from '../../src/server/modules/auth';

/**
 * Full auth journey through the real route handlers (AGENTS.md §17):
 * register → OTP → login, cookie/CSRF handling, profile update, RBAC and
 * cross-origin rejection. No HTTP server and no network.
 */

const ORIGIN = 'http://localhost:3000';

interface RequestOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  csrf?: string;
  origin?: string;
}

function apiRequest(path: string, options: RequestOptions = {}): Request {
  const headers: Record<string, string> = {
    origin: options.origin ?? ORIGIN,
  };

  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers['x-csrf-token'] = options.csrf;

  return new Request(`${ORIGIN}${path}`, {
    method: options.method ?? 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function cookiePair(response: Response, name: string): string {
  const found = response.headers.getSetCookie().find((cookie) => cookie.trim().startsWith(`${name}=`));

  if (!found) throw new Error(`missing ${name} cookie`);
  return found.split(';')[0] ?? '';
}

function cookieValue(pair: string): string {
  const separator = pair.indexOf('=');
  return decodeURIComponent(pair.slice(separator + 1));
}

function devCodeFor(email: string): string {
  const otp: DevOtp | null = getDevOtp(email);
  if (!otp) throw new Error('no dev OTP recorded for the test address');
  return otp.code;
}

beforeAll(async () => {
  await runSeed({ handle: getDb(), includeDemoAccounts: true });
});

beforeEach(() => {
  loginRateLimiter.reset();
  resetDevOtps();
});

afterAll(async () => {
  resetAuthService();
  await closeDb();
});

describe('auth API flow', () => {
  it('UT_USR_56 register, verify and login issue a protected session', async () => {
    const email = 'api.flow@lawtrack.in';
    const password = 'Legal1234';

    const registered = await register(
      apiRequest('/api/auth/register', {
        body: {
          name: 'API Flow Citizen',
          email,
          phone_number: '+919876543210',
          password,
          role: 'Citizen',
          language: 'English',
        },
      }),
    );
    expect(registered.status).toBe(201);

    const registration = (await registered.json()) as {
      user: { id: number; email: string; phoneNumber: string | null; isVerified: boolean };
      delivery: { channel: string; destination: string };
      next: string;
    };
    expect(registration.user.email).toBe(email);
    expect(registration.user.phoneNumber).toBe('9876543210');
    expect(registration.user.isVerified).toBe(false);
    expect(registration.delivery.destination).not.toContain(email);
    expect(registration.next).toBe(`/verify-otp?email=${encodeURIComponent(email)}`);

    const code = devCodeFor(email);

    const blocked = await login(apiRequest('/api/auth/login', { body: { email, password } }));
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({
      error: { code: 'ACCOUNT_NOT_VERIFIED', message: 'Account not verified' },
    });

    const wrongCode = await verifyOtp(
      apiRequest('/api/auth/verify-otp', { body: { email, code: '000000' } }),
    );
    expect(wrongCode.status).toBe(400);
    expect(await wrongCode.json()).toMatchObject({ error: { code: 'OTP_INVALID' } });

    const verified = await verifyOtp(apiRequest('/api/auth/verify-otp', { body: { email, code } }));
    expect(verified.status).toBe(200);

    const verifiedBody = (await verified.json()) as {
      user: { isVerified: boolean; role: string };
      redirectTo: string;
    };
    expect(verifiedBody.user.isVerified).toBe(true);
    expect(verifiedBody.redirectTo).toBe('/citizen');

    const sessionCookie = cookiePair(verified, 'lawtrack_session');
    const csrfCookie = cookiePair(verified, 'lawtrack_csrf');
    const csrfToken = cookieValue(csrfCookie);
    const authCookie = `${sessionCookie}; ${csrfCookie}`;

    const profile = await me(apiRequest('/api/auth/me', { method: 'GET', cookie: authCookie }));
    expect(profile.status).toBe(200);
    expect(await profile.json()).toMatchObject({
      user: { email, role: 'Citizen', isVerified: true },
    });

    const withoutCsrf = await updateProfile(
      apiRequest('/api/auth/profile', {
        method: 'PATCH',
        cookie: authCookie,
        body: { name: 'No Token' },
      }),
    );
    expect(withoutCsrf.status).toBe(403);
    expect(await withoutCsrf.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });

    const crossOrigin = await updateProfile(
      apiRequest('/api/auth/profile', {
        method: 'PATCH',
        cookie: authCookie,
        csrf: csrfToken,
        origin: 'http://evil.example',
        body: { name: 'Cross Origin' },
      }),
    );
    expect(crossOrigin.status).toBe(403);
    expect(await crossOrigin.json()).toMatchObject({
      error: { code: 'FORBIDDEN_ORIGIN' },
    });

    const updated = await updateProfile(
      apiRequest('/api/auth/profile', {
        method: 'PATCH',
        cookie: authCookie,
        csrf: csrfToken,
        body: { name: 'API Flow Updated', language: 'Hindi' },
      }),
    );
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      user: { name: 'API Flow Updated', language: 'Hindi' },
    });

    const updatedSession = cookiePair(updated, 'lawtrack_session');

    const signedOut = await logout(
      apiRequest('/api/auth/logout', {
        cookie: `${updatedSession}; ${csrfCookie}`,
        csrf: csrfToken,
      }),
    );
    expect(signedOut.status).toBe(200);
    const cleared = signedOut.headers.getSetCookie().join('\n');
    expect(cleared).toContain('lawtrack_session=;');
    expect(cleared).toContain('lawtrack_csrf=;');

    const signedIn = await login(apiRequest('/api/auth/login', { body: { email, password } }));
    expect(signedIn.status).toBe(200);
    expect(await signedIn.json()).toMatchObject({
      user: { name: 'API Flow Updated', language: 'Hindi' },
      redirectTo: '/citizen',
    });
    expect(signedIn.headers.getSetCookie()).toHaveLength(2);
  });

  it('UT_USR_57 resend OTP is neutral for unknown addresses and returns a dev code in tests', async () => {
    const unknown = await resendOtp(
      apiRequest('/api/auth/resend-otp', { body: { email: 'nobody@lawtrack.in' } }),
    );
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual({ sent: false });

    const email = 'api.resend@lawtrack.in';
    const registered = await register(
      apiRequest('/api/auth/register', {
        body: {
          name: 'Resend Citizen',
          email,
          password: 'Legal1234',
          role: 'Citizen',
          language: 'English',
        },
      }),
    );
    expect(registered.status).toBe(201);

    const firstCode = devCodeFor(email);
    const tooSoon = await resendOtp(apiRequest('/api/auth/resend-otp', { body: { email } }));
    expect(tooSoon.status).toBe(429);
    expect(await tooSoon.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });

    // Simulate the 60-second cooldown having elapsed.
    getDb()
      .sqlite.prepare(
        'UPDATE Otp_Code SET created_at = ? WHERE user_id = (SELECT user_id FROM User WHERE email = ?)',
      )
      .run('2026-11-10 10:00:00', email);

    const resent = await resendOtp(apiRequest('/api/auth/resend-otp', { body: { email } }));
    expect(resent.status).toBe(200);
    const resentBody = (await resent.json()) as { sent: boolean; retryAfterSeconds: number };
    expect(resentBody.sent).toBe(true);
    expect(resentBody.retryAfterSeconds).toBe(60);
    expect(devCodeFor(email)).not.toBe(firstCode);
  });

  it('UT_USR_58 a citizen session cannot pass a lawyer-only route guard', async () => {
    const email = 'api.rbac@lawtrack.in';
    const password = 'Legal1234';

    await register(
      apiRequest('/api/auth/register', {
        body: {
          name: 'RBAC Citizen',
          email,
          password,
          role: 'Citizen',
          language: 'English',
        },
      }),
    );
    const verified = await verifyOtp(
      apiRequest('/api/auth/verify-otp', { body: { email, code: devCodeFor(email) } }),
    );
    const sessionCookie = cookiePair(verified, 'lawtrack_session');

    const { withAuth } = await import('../../src/server/http/auth');
    const lawyerOnly = withAuth(async () => new Response('unreachable'), {
      roles: ['Lawyer'],
    });

    await expect(
      lawyerOnly(apiRequest('/api/lawyer/queue', { method: 'GET', cookie: sessionCookie })),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });
});
