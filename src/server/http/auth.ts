import 'server-only';

import type { RouteHandler } from './handler';
import { assertCsrf } from './csrf';
import { isMutatingMethod } from './origin';
import { requireSession } from './session';
import { forbidden } from '../lib/errors';
import type { SessionClaims } from '../../shared/session';
import type { UserRole } from '../../shared/enums';

/**
 * Route-handler authentication/authorisation wrapper (AGENTS.md §3, §16).
 *
 * Order: session → role → CSRF (for mutations). Every protected route uses
 * this, so a handler can never forget one of the three checks. Object-level
 * ownership is still checked by the service for each record.
 */

export type SessionHandler<Context = unknown> = (
  request: Request,
  session: SessionClaims,
  context?: Context,
) => Promise<Response> | Response;

export interface AuthOptions {
  /** Roles allowed through; omit for "any signed-in user". */
  roles?: readonly UserRole[];
}

export function withAuth<Context = unknown>(
  handler: SessionHandler<Context>,
  options: AuthOptions = {},
): RouteHandler<Context> {
  return async (request: Request, context?: Context): Promise<Response> => {
    const session = await requireSession(request);

    if (options.roles && !options.roles.includes(session.role)) {
      throw forbidden();
    }

    if (isMutatingMethod(request.method)) {
      assertCsrf(request);
    }

    return handler(request, session, context);
  };
}
