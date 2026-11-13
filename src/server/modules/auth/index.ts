import 'server-only';

import { createMockOtpGateway } from '../../adapters/otp';
import { getEnv } from '../../config/env';
import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { logger } from '../../lib/logger';
import { loginRateLimiter } from '../../http/rateLimit';
import { createAuthService, type AuthService } from './service';

/**
 * Process-wide auth service. Built lazily on first request and cached on
 * `globalThis` so Next.js dev hot-reload does not rebuild the gateway/limiter
 * every time (AGENTS.md §12 uses the same pattern for jobs).
 */

interface AuthCache {
  service?: AuthService;
}

const globalForAuth = globalThis as typeof globalThis & { __lawtrackAuth?: AuthCache };
const cache: AuthCache = globalForAuth.__lawtrackAuth ?? (globalForAuth.__lawtrackAuth = {});

export function getAuthService(): AuthService {
  if (!cache.service) {
    const handle = getDb();
    const repos = createRepositories(handle);
    const env = getEnv();

    cache.service = createAuthService({
      repos,
      clock: systemClock,
      loginLimiter: loginRateLimiter,
      gateway: createMockOtpGateway({
        repos,
        clock: systemClock,
        isProduction: env.isProduction,
        logger,
      }),
    });
  }

  return cache.service;
}

/** Test hook: forget the cached service (used after swapping the database). */
export function resetAuthService(): void {
  cache.service = undefined;
}
