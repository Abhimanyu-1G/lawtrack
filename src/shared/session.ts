import type { UserRole } from './enums';

/**
 * Session constants shared by the Edge middleware and Node server code.
 * Pure values only — no Node APIs, no secrets.
 */
export const SESSION_COOKIE = 'lawtrack_session';

/** Preferred public-page language; mirrors the profile language for staff. */
export const LOCALE_COOKIE = 'lawtrack_lang';

/** Cookie used for the double-submit CSRF token (AGENTS.md §16). */
export const CSRF_COOKIE = 'lawtrack_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export interface SessionClaims {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
  language: 'English' | 'Hindi';
}

/** Route prefix owned by each role (middleware fast-path check). */
export const ROLE_ROUTE_PREFIX: Record<UserRole, string> = {
  Citizen: '/citizen',
  Lawyer: '/lawyer',
  Curator: '/curator',
  Administrator: '/admin',
  'API Manager': '/api-manager',
};

export const PROTECTED_ROUTE_RULES: { prefix: string; role: UserRole }[] = (
  Object.entries(ROLE_ROUTE_PREFIX) as [UserRole, string][]
).map(([role, prefix]) => ({ prefix, role }));

export function isPathInPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
