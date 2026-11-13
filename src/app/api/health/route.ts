import 'server-only';

import { APP_VERSION } from '../../../shared/version';
import { getEnv } from '../../../server/config/env';
import { getDb } from '../../../server/db/client';
import { listAppliedMigrations } from '../../../server/db/migrate';
import { jsonResponse, withApiHandler } from '../../../server/http/handler';
import { systemClock, type Clock } from '../../../server/lib/clock';
import { logger } from '../../../server/lib/logger';

/**
 * GET /api/health — liveness + readiness probe.
 *
 * Never exposes secrets. Reports database reachability, how many migrations are
 * applied, whether the app runs in mock AI mode and whether jobs are enabled.
 * Returns 503 when the database cannot be reached.
 */

interface HealthPayload {
  status: 'healthy' | 'unhealthy';
  service: 'lawtrack';
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: {
      status: 'up' | 'down';
      migrationsApplied: number;
      migrations: string[];
    };
  };
  features: {
    aiMode: 'gemini' | 'mock';
    jobsEnabled: boolean;
    devShowOtp: boolean;
  };
}

export function buildHealth(clock: Clock = systemClock): { status: number; payload: HealthPayload } {
  const env = getEnv();
  let databaseStatus: 'up' | 'down' = 'up';
  let migrations: string[] = [];

  try {
    const handle = getDb();
    handle.sqlite.prepare('SELECT 1').get();
    migrations = listAppliedMigrations(handle);
  } catch (error) {
    databaseStatus = 'down';
    logger.error({ err: error }, 'health check: database unreachable');
  }

  const payload: HealthPayload = {
    status: databaseStatus === 'up' ? 'healthy' : 'unhealthy',
    service: 'lawtrack',
    version: APP_VERSION,
    timestamp: clock.nowIso(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database: {
        status: databaseStatus,
        migrationsApplied: migrations.length,
        migrations,
      },
    },
    features: {
      aiMode: env.aiMode,
      jobsEnabled: env.JOBS_ENABLED,
      devShowOtp: env.DEV_SHOW_OTP,
    },
  };

  return { status: databaseStatus === 'up' ? 200 : 503, payload };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function healthHandler(): Promise<Response> {
  const { status, payload } = buildHealth();
  return jsonResponse(payload, { status });
}

export const GET = withApiHandler(healthHandler, { name: 'GET /api/health' });
