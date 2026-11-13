import 'server-only';

import { ECOURTS_FIXTURES } from './fixtures';
import {
  ECourtsNotFoundError,
  ECourtsTimeoutError,
  type ECourtsCase,
  type ECourtsClient,
} from './types';

/**
 * Deterministic eCourts mock (AGENTS.md §11).
 *
 * - Looks the CNR up in `fixtures.ts`; unknown CNRs behave like a real miss.
 * - Adds 300–800 ms of latency by default so the UI's loading state is real.
 * - Honours the dev-only "simulate outage" switch owned by `./index.ts`.
 *
 * Tests pass `latencyMs: 0` so the suite never sleeps.
 */

export interface MockECourtsOptions {
  latencyMs?: number;
  isOutage?: () => boolean;
  random?: () => number;
}

export function createMockECourtsClient(options: MockECourtsOptions = {}): ECourtsClient {
  const random = options.random ?? Math.random;
  const isOutage = options.isOutage ?? (() => false);

  async function latency(): Promise<void> {
    const configured = options.latencyMs;
    const delay = configured ?? 300 + Math.round(random() * 500);
    if (delay <= 0) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delay);
    });
  }

  return {
    name: 'mock',

    async getCaseByCnr(cnr: string): Promise<ECourtsCase> {
      await latency();

      if (isOutage()) {
        throw new ECourtsTimeoutError('eCourts is not responding (simulated outage)');
      }

      const fixture = ECOURTS_FIXTURES[cnr];
      if (!fixture) throw new ECourtsNotFoundError(cnr);
      if (fixture.behaviour === 'timeout' || !fixture.case) {
        throw new ECourtsTimeoutError('eCourts did not answer this CNR in time');
      }

      return fixture.case;
    },
  };
}
