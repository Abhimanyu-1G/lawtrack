/**
 * Runs once when the Next.js server boots (Node.js runtime only).
 *
 * Today it validates the environment and logs a boot line. Phase 6 registers
 * the background jobs here; the global singleton guard stays either way so dev
 * hot-reload never double-starts anything (AGENTS.md §12).
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const globalState = globalThis as typeof globalThis & { __lawtrackBooted?: boolean };
  if (globalState.__lawtrackBooted) return;
  globalState.__lawtrackBooted = true;

  const { getEnv } = await import('./server/config/env');
  const { logger } = await import('./server/lib/logger');

  try {
    const env = getEnv();
    logger.info(
      {
        nodeEnv: env.NODE_ENV,
        aiMode: env.aiMode,
        jobsEnabled: env.JOBS_ENABLED,
        dbPath: env.DB_PATH,
      },
      'LawTrack instrumentation ready',
    );
  } catch (error) {
    logger.error({ err: error }, 'Environment validation failed — refusing to start');
    throw error;
  }
}
