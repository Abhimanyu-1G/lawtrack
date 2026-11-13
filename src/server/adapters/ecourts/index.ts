import 'server-only';

import type { AppEnv } from '../../config/env';
import { getEnv } from '../../config/env';
import { createMockECourtsClient } from './mock';
import { createRealECourtsClient } from './real';
import type { ECourtsClient } from './types';

export type { ECourtsCase, ECourtsClient, ECourtsHearing } from './types';
export {
  ECourtsNotFoundError,
  ECourtsTimeoutError,
  ECourtsUnavailableError,
} from './types';
export { ECOURTS_PROBE_CNR, SAMPLE_ORDER_URL } from './fixtures';

/**
 * Adapter selection plus the dev-only outage switch (AGENTS.md §11).
 *
 * `ECOURTS_MODE=mock` (the default) keeps the prototype offline. The outage
 * flag is a process-wide singleton so the API-manager simulator and every
 * subsequent lookup agree, and it is only honoured outside production.
 */

interface ECourtsState {
  outage: boolean;
  client?: ECourtsClient;
}

const globalForECourts = globalThis as typeof globalThis & { __lawtrackECourts?: ECourtsState };
const state: ECourtsState = globalForECourts.__lawtrackECourts ?? (globalForECourts.__lawtrackECourts = {
  outage: false,
});

export function isECourtsOutage(): boolean {
  return state.outage;
}

/** Toggle the simulated outage. Refused in production. */
export function setECourtsOutage(enabled: boolean): boolean {
  if (process.env.NODE_ENV === 'production') return state.outage;
  state.outage = enabled;
  return state.outage;
}

export function createECourtsClient(env: AppEnv): ECourtsClient {
  if (env.ECOURTS_MODE === 'real') return createRealECourtsClient();
  return createMockECourtsClient({ isOutage: isECourtsOutage });
}

export function getECourtsClient(): ECourtsClient {
  if (!state.client) state.client = createECourtsClient(getEnv());
  return state.client;
}

/** Test hook: forget the cached client after swapping configuration. */
export function resetECourtsClient(): void {
  state.client = undefined;
  state.outage = false;
}
