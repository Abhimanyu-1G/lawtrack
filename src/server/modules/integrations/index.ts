import 'server-only';

import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { createIntegrationsService, type IntegrationsService } from './service';

/** Process-wide integrations service, cached across Next.js dev reloads. */
interface IntegrationsCache {
  service?: IntegrationsService;
}

const globalForIntegrations = globalThis as typeof globalThis & { __lawtrackIntegrations?: IntegrationsCache };
const cache: IntegrationsCache = globalForIntegrations.__lawtrackIntegrations ?? (globalForIntegrations.__lawtrackIntegrations = {});

export function getIntegrationsService(): IntegrationsService {
  if (!cache.service) {
    cache.service = createIntegrationsService({
      repos: createRepositories(getDb()),
      clock: systemClock,
    });
  }
  return cache.service;
}

/** Test hook: forget the cached service after swapping the database. */
export function resetIntegrationsService(): void {
  cache.service = undefined;
}