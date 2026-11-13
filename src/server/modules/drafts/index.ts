import 'server-only';

import { getAiProvider } from '../../adapters/ai';
import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { createDraftsService, type DraftService } from './service';

/** Process-wide drafts service, cached across Next.js dev hot reloads. */
interface DraftsCache {
  service?: DraftService;
}

const globalForDrafts = globalThis as typeof globalThis & { __lawtrackDrafts?: DraftsCache };
const cache: DraftsCache = globalForDrafts.__lawtrackDrafts ?? (globalForDrafts.__lawtrackDrafts = {});

export function getDraftsService(): DraftService {
  if (!cache.service) {
    const repos = createRepositories(getDb());
    cache.service = createDraftsService({
      repos,
      clock: systemClock,
      ai: getAiProvider(repos, systemClock),
    });
  }
  return cache.service;
}

/** Test hook: forget the cached service (used after swapping the database). */
export function resetDraftsService(): void {
  cache.service = undefined;
}
