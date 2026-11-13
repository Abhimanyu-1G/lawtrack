import 'server-only';

import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { createAuditService, type AuditService } from './service';

/** Process-wide audit viewer, cached across Next.js dev reloads. */
interface AuditCache {
  service?: AuditService;
}

const globalForAudit = globalThis as typeof globalThis & { __lawtrackAudit?: AuditCache };
const cache: AuditCache = globalForAudit.__lawtrackAudit ?? (globalForAudit.__lawtrackAudit = {});

export function getAuditService(): AuditService {
  if (!cache.service) {
    cache.service = createAuditService({ repos: createRepositories(getDb()) });
  }
  return cache.service;
}

/** Test hook: forget the cached service after swapping the database. */
export function resetAuditService(): void {
  cache.service = undefined;
}
