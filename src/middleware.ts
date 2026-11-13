import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

import { isPathInPrefix, PROTECTED_ROUTE_RULES, SESSION_COOKIE } from './shared/session';

/**
 * Edge-safe authentication gate (AGENTS.md §2, §16).
 *
 * This is the *fast* check: it only verifies the JWT signature and role claim,
 * never touches the database. Every role layout re-checks authorisation on the
 * server (authoritative) and every route handler re-checks auth itself.
 *
 * Note: Next.js 16 renamed this convention to `proxy.ts` and logs a deprecation
 * warning for `middleware.ts`; this project keeps `middleware.ts` because
 * AGENTS.md specifies it. See docs/DECISIONS.md.
 */

function secretKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

function redirectToLogin(request: NextRequest, clearCookie: boolean): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(loginUrl);
  if (clearCookie) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const rule = PROTECTED_ROUTE_RULES.find((candidate) => isPathInPrefix(pathname, candidate.prefix));
  if (!rule) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return redirectToLogin(request, false);

  const key = secretKey();
  if (!key) {
    // Fail closed: a broken configuration must never expose a protected page.
    return redirectToLogin(request, true);
  }

  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    if (payload.role !== rule.role) {
      return NextResponse.redirect(new URL('/forbidden', request.url));
    }
    return NextResponse.next();
  } catch {
    return redirectToLogin(request, true);
  }
}

export const config = {
  // Literal matchers: Next.js analyses this at build time.
  matcher: [
    '/citizen',
    '/citizen/:path*',
    '/lawyer',
    '/lawyer/:path*',
    '/curator',
    '/curator/:path*',
    '/admin',
    '/admin/:path*',
    '/api-manager',
    '/api-manager/:path*',
  ],
};
