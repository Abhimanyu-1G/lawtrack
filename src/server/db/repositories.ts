import 'server-only';

import { createAuditRepo } from '../modules/audit/repo';
import { createCasesRepo } from '../modules/cases/repo';
import { createGuidesRepo } from '../modules/guides/repo';
import { createChatRepo } from '../modules/chat/repo';
import { createDraftsRepo } from '../modules/drafts/repo';
import { createIntegrationsRepo } from '../modules/integrations/repo';
import { createMetricsRepo } from '../modules/metrics/repo';
import { createNotificationsRepo } from '../modules/notifications/repo';
import { createOtpRepo } from '../modules/otp/repo';
import { createSettingsRepo } from '../modules/settings/repo';
import { createUsersRepo } from '../modules/users/repo';
import type { LawTrackDatabase } from './client';

/**
 * One place that wires repositories to a database handle. Services receive this
 * object, never a raw connection, which keeps the layering
 * `route handler → service → repository → db` intact.
 */
export function createRepositories(handle: LawTrackDatabase) {
  return {
    users: createUsersRepo(handle.db),
    guides: createGuidesRepo(handle.db),
    integrations: createIntegrationsRepo(handle.db),
    settings: createSettingsRepo(handle.db),
    audit: createAuditRepo(handle.db),
    otp: createOtpRepo(handle.db),
    notifications: createNotificationsRepo(handle.db),
    chat: createChatRepo(handle.db),
    drafts: createDraftsRepo(handle.db),
    cases: createCasesRepo(handle.db),
    metrics: createMetricsRepo(handle.db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
