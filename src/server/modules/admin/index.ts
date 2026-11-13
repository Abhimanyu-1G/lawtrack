import 'server-only';

import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { createAdminCategoriesService, type AdminCategoriesService } from './categories';
import { createAdminUserService, type AdminUserService } from './service';

/** Process-wide administrator services, cached across Next.js dev reloads. */
interface AdminCache {
  users?: AdminUserService;
  categories?: AdminCategoriesService;
}

const globalForAdmin = globalThis as typeof globalThis & { __lawtrackAdmin?: AdminCache };
const cache: AdminCache = globalForAdmin.__lawtrackAdmin ?? (globalForAdmin.__lawtrackAdmin = {});

function repos() {
  return createRepositories(getDb());
}

export function getAdminUserService(): AdminUserService {
  if (!cache.users) {
    cache.users = createAdminUserService({ repos: repos(), clock: systemClock });
  }
  return cache.users;
}

export function getAdminCategoriesService(): AdminCategoriesService {
  if (!cache.categories) {
    cache.categories = createAdminCategoriesService({ repos: repos(), clock: systemClock });
  }
  return cache.categories;
}

/** Test hook: forget the cached services after swapping the database. */
export function resetAdminServices(): void {
  cache.users = undefined;
  cache.categories = undefined;
}
