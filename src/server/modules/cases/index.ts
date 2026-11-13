import 'server-only';

import { getAiProvider } from '../../adapters/ai';
import { getECourtsClient } from '../../adapters/ecourts';
import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { createCasesService, type CasesService } from './service';

/** Process-wide cases service, cached across Next.js dev hot reloads. */
interface CasesCache {
  service?: CasesService;
}

const globalForCases = globalThis as typeof globalThis & { __lawtrackCases?: CasesCache };
const cache: CasesCache = globalForCases.__lawtrackCases ?? (globalForCases.__lawtrackCases = {});

export function getCasesService(): CasesService {
  if (!cache.service) {
    const repos = createRepositories(getDb());
    cache.service = createCasesService({
      repos,
      clock: systemClock,
      ai: getAiProvider(repos, systemClock),
      ecourts: getECourtsClient(),
    });
  }
  return cache.service;
}

/** Test hook: forget the cached service (used after swapping the database). */
export function resetCasesService(): void {
  cache.service = undefined;
}
