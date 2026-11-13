import 'server-only';

import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { createMetricsService, type MetricsService } from './service';

/** Process-wide metrics service, cached across Next.js dev reloads. */
interface MetricsCache {
  service?: MetricsService;
}

const globalForMetrics = globalThis as typeof globalThis & { __lawtrackMetrics?: MetricsCache };
const cache: MetricsCache =
  globalForMetrics.__lawtrackMetrics ?? (globalForMetrics.__lawtrackMetrics = {});

export function getMetricsService(): MetricsService {
  if (!cache.service) {
    cache.service = createMetricsService({
      repos: createRepositories(getDb()),
      clock: systemClock,
    });
  }
  return cache.service;
}

/** Test hook: forget the cached service after swapping the database. */
export function resetMetricsService(): void {
  cache.service = undefined;
}
