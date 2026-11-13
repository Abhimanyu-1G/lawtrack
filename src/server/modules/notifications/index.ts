import 'server-only';

import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { createNotificationsService, type NotificationsService } from './service';

/** Process-wide notifications service, cached across Next.js dev reloads. */
interface NotificationsCache {
  service?: NotificationsService;
}

const globalForNotifications = globalThis as typeof globalThis & {
  __lawtrackNotifications?: NotificationsCache;
};
const cache: NotificationsCache =
  globalForNotifications.__lawtrackNotifications ??
  (globalForNotifications.__lawtrackNotifications = {});

export function getNotificationsService(): NotificationsService {
  if (!cache.service) {
    cache.service = createNotificationsService({
      repos: createRepositories(getDb()),
      clock: systemClock,
    });
  }
  return cache.service;
}

/** Test hook: forget the cached service after swapping the database. */
export function resetNotificationsService(): void {
  cache.service = undefined;
}
