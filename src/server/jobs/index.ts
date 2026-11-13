import 'server-only';

import { getAiProvider, setForceMockAi } from '../adapters/ai';
import { ECOURTS_PROBE_CNR, getECourtsClient } from '../adapters/ecourts';
import { getDb } from '../db/client';
import { createRepositories } from '../db/repositories';
import { systemClock, type Clock } from '../lib/clock';
import { logger } from '../lib/logger';
import { getCasesService, resetCasesService } from '../modules/cases';
import { getDraftsService, resetDraftsService } from '../modules/drafts';

/**
 * Background jobs (AGENTS.md §12).
 *
 * 1. Case sync — refresh every tracked case (batch, concurrency 3).
 * 2. Hearing reminders — In-App + mock Email/SMS inside the 48-hour window.
 * 3. Integration health — probe eCourts and keep `API_Integration` truthful,
 *    plus an availability sample for the §14 dashboard.
 * 4. Stale review locks — drop expired lawyer claims.
 *
 * Jobs are idempotent, never overlap (`running` flags), log their duration and
 * can be triggered manually from the API-manager console through
 * `POST /api/jobs/run`. On a serverless host these would move to an external
 * scheduler calling that endpoint (see docs/DECISIONS.md D-51).
 */

export const JOB_NAMES = ['case-sync', 'hearing-reminders', 'health-checks', 'lock-cleanup'] as const;
export type JobName = (typeof JOB_NAMES)[number];

export interface JobOutcome {
  job: JobName;
  ok: boolean;
  durationMs: number;
  detail: Record<string, number>;
}

export interface JobDependencies {
  clock: Clock;
  repos: ReturnType<typeof createRepositories>;
  cases: ReturnType<typeof getCasesService>;
  drafts: ReturnType<typeof getDraftsService>;
  ecourts: ReturnType<typeof getECourtsClient>;
}

function dependencies(): JobDependencies {
  const repos = createRepositories(getDb());
  return {
    clock: systemClock,
    repos,
    cases: getCasesService(),
    drafts: getDraftsService(),
    ecourts: getECourtsClient(),
  };
}

async function caseSync(deps: JobDependencies): Promise<Record<string, number>> {
  const summary = await deps.cases.refreshTrackedCases();
  return { attempted: summary.attempted, succeeded: summary.succeeded, failed: summary.failed };
}

async function hearingReminders(deps: JobDependencies): Promise<Record<string, number>> {
  const result = await deps.cases.sendHearingReminders();
  return { sent: result.sent };
}

async function healthChecks(deps: JobDependencies): Promise<Record<string, number>> {
  const at = deps.clock.nowIso();
  let healthy = 0;
  let failed = 0;

  try {
    await deps.ecourts.getCaseByCnr(ECOURTS_PROBE_CNR);
    await deps.repos.integrations.recordSuccess(1, at);
    healthy += 1;
  } catch (error) {
    const health = await deps.repos.integrations.recordFailure(1);
    logger.warn({ err: error, status: health.status }, 'eCourts health probe failed');
    failed += 1;
  }

  // Gemini is healthy when it is either not configured (mock mode) or has just
  // answered; the AI adapter itself records failures on real calls.
  const gemini = await deps.repos.integrations.findById(2);
  const geminiHealthy = !gemini || gemini.status === 'Healthy' || getAiProvider().demo;
  if (gemini && geminiHealthy && gemini.status !== 'Healthy') {
    await deps.repos.integrations.recordSuccess(2, at);
  }
  if (geminiHealthy) healthy += 1;
  else failed += 1;

  // The mock OTP gateway and India Code clients cannot fail.
  for (const integrationId of [3, 4]) {
    const row = await deps.repos.integrations.findById(integrationId);
    if (!row) continue;
    if (row.status !== 'Healthy') await deps.repos.integrations.recordSuccess(integrationId, at);
    healthy += 1;
  }

  await deps.repos.metrics.record({
    metric: 'availability',
    value: failed === 0 ? 1 : 0,
    refId: `health:${at}`,
    at,
  });

  return { healthy, failed };
}

async function lockCleanup(deps: JobDependencies): Promise<Record<string, number>> {
  const released = await deps.drafts.releaseExpiredClaims();
  return { released };
}

const RUNNERS: Record<JobName, (deps: JobDependencies) => Promise<Record<string, number>>> = {
  'case-sync': caseSync,
  'hearing-reminders': hearingReminders,
  'health-checks': healthChecks,
  'lock-cleanup': lockCleanup,
};

interface JobState {
  running: Set<JobName>;
  timers: NodeJS.Timeout[];
  started: boolean;
}

const globalForJobs = globalThis as typeof globalThis & { __lawtrackJobs?: JobState };
const state: JobState =
  globalForJobs.__lawtrackJobs ?? (globalForJobs.__lawtrackJobs = {
    running: new Set<JobName>(),
    timers: [],
    started: false,
  });

/** Run one job, skipping it when the previous run has not finished. */
export async function runJob(job: JobName): Promise<JobOutcome> {
  if (state.running.has(job)) {
    return { job, ok: false, durationMs: 0, detail: { skipped: 1 } };
  }

  state.running.add(job);
  const startedAt = Date.now();
  try {
    const detail = await RUNNERS[job](dependencies());
    const durationMs = Date.now() - startedAt;
    logger.info({ job, durationMs, ...detail }, 'background job finished');
    return { job, ok: true, durationMs, detail };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error({ err: error, job, durationMs }, 'background job failed');
    return { job, ok: false, durationMs, detail: { failed: 1 } };
  } finally {
    state.running.delete(job);
  }
}

async function intervalMinutes(key: string, fallback: number): Promise<number> {
  const repos = createRepositories(getDb());
  const value = await repos.settings.getNumber(key, fallback);
  return value > 0 ? value : fallback;
}

/**
 * Register the timers once per process. `instrumentation.ts` calls this on the
 * Node runtime; the global singleton stops Next.js dev hot reload from starting
 * a second set.
 */
export async function startJobs(): Promise<void> {
  if (state.started) return;
  if (process.env.JOBS_ENABLED === 'false') {
    logger.info('background jobs disabled by JOBS_ENABLED=false');
    return;
  }

  state.started = true;

  // Honour the administrator AI switch before the first request is served.
  const repos = createRepositories(getDb());
  setForceMockAi((await repos.settings.get('demo_ai_mode')) === 'off');

  const schedule: { job: JobName; setting: string; fallback: number }[] = [
    { job: 'case-sync', setting: 'case_sync_interval_minutes', fallback: 5 },
    { job: 'hearing-reminders', setting: 'hearing_reminder_interval_minutes', fallback: 15 },
    { job: 'health-checks', setting: 'integration_health_interval_minutes', fallback: 2 },
    { job: 'lock-cleanup', setting: 'review_lock_cleanup_interval_minutes', fallback: 5 },
  ];

  for (const entry of schedule) {
    const minutes = await intervalMinutes(entry.setting, entry.fallback);
    const timer = setInterval(
      () => {
        void runJob(entry.job);
      },
      minutes * 60_000,
    );
    timer.unref();
    state.timers.push(timer);
  }

  logger.info({ jobs: schedule.map((entry) => entry.job) }, 'background jobs started');
}

/** Stop every timer (tests and graceful shutdown). */
export function stopJobs(): void {
  for (const timer of state.timers) clearInterval(timer);
  state.timers = [];
  state.started = false;
  state.running.clear();
}

/** Test hook: rebuild the cached services after swapping the database. */
export function resetJobs(): void {
  stopJobs();
  resetCasesService();
  resetDraftsService();
}
