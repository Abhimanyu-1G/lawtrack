import 'server-only';

import { SignJWT, jwtVerify } from 'jose';

import { USER_ROLES, LANGUAGES, type UserRole, type Language } from '../../shared/enums';
import type { SessionClaims } from '../../shared/session';
import { getEnv } from '../config/env';

/**
 * Signed session tokens (AGENTS.md §0, §16): HS256 JWT in an httpOnly cookie.
 * The middleware verifies the same token on the Edge; this module is the
 * Node-side issuer/reader. Claims are small and non-sensitive — never a role
 * profile or PII beyond name/email needed for the shell.
 */

const ISSUER = 'lawtrack';
const AUDIENCE = 'lawtrack-web';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    role: claims.role,
    email: claims.email,
    name: claims.name,
    language: claims.language,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Verify a token; returns `null` for anything tampered, stale or malformed. */
export async function readSessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (
      typeof payload.sub !== 'string' ||
      !isUserRole(payload.role) ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      !isLanguage(payload.language)
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
      name: payload.name,
      language: payload.language,
    };
  } catch {
    return null;
  }
}
