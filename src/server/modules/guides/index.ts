import 'server-only';

import { getAiProvider } from '../../adapters/ai';
import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { createGuidesService, type GuideService } from './service';

/** Process-wide guides service, cached across Next.js dev hot reloads. */
interface GuidesCache {
  service?: GuideService;
}

const globalForGuides = globalThis as typeof globalThis & { __lawtrackGuides?: GuidesCache };
const cache: GuidesCache = globalForGuides.__lawtrackGuides ?? (globalForGuides.__lawtrackGuides = {});

export function getGuidesService(): GuideService {
  if (!cache.service) {
    const repos = createRepositories(getDb());
    cache.service = createGuidesService({
      repos,
      clock: systemClock,
      ai: getAiProvider(repos, systemClock),
    });
  }
  return cache.service;
}

/** Test hook: forget the cached service (used after swapping the database). */
export function resetGuidesService(): void {
  cache.service = undefined;
}
