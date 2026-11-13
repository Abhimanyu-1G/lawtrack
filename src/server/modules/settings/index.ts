import 'server-only';

import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { createSettingsService, type SettingsService } from './service';

/** Process-wide administrator settings service, cached across dev reloads. */
interface SettingsCache {
  service?: SettingsService;
}

const globalForSettings = globalThis as typeof globalThis & { __lawtrackSettings?: SettingsCache };
const cache: SettingsCache =
  globalForSettings.__lawtrackSettings ?? (globalForSettings.__lawtrackSettings = {});

export function getSettingsService(): SettingsService {
  if (!cache.service) {
    cache.service = createSettingsService({
      repos: createRepositories(getDb()),
      clock: systemClock,
    });
  }
  return cache.service;
}

/** Test hook: forget the cached service after swapping the database. */
export function resetSettingsService(): void {
  cache.service = undefined;
}
