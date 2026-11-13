import 'server-only';

import { categoryLabel, formatMessage, getDictionary, type Locale } from '../../../i18n';
import { validateLegislativeChangeInput } from '../../../shared/validation';
import { createMockIndiaCodeClient, type LegislativeChange } from '../../adapters/indiacode';
import { setECourtsOutage } from '../../adapters/ecourts';
import { getECourtsClient } from '../../adapters/ecourts';
import { getAiProvider, isForceMockAi } from '../../adapters/ai';
import type { Repositories } from '../../db/repositories';
import { createValidationContext } from '../../http/validationContext';
import type { Clock } from '../../lib/clock';
import { validationFailed } from '../../lib/errors';

/**
 * Integration services (AGENTS.md §11, UC-05).
 *
 * Today this is the mock India Code webhook: it flags every published guide in
 * the affected topic, notifies all curators, records the integration health and
 * writes one audit row. It never edits guide content itself.
 */

export const INDIA_CODE_INTEGRATION_ID = 3;

export interface LegislativeChangeResult {
  change: LegislativeChange;
  flaggedGuides: number;
  notifiedCurators: number;
}

export interface IntegrationsService {
  simulateLegislativeChange(
    actorId: number,
    input: unknown,
    locale: Locale,
  ): Promise<LegislativeChangeResult>;

  /** All seeded integrations with their current health. */
  list(): Promise<
    { id: number; managerId: number; serviceName: string; status: string; lastSyncTime: string | null; errorCount: number }[]
  >;

  /** Probe one integration (eCourts or Gemini) and update its health. */
  check(id: number): Promise<{ id: number; status: string; errorCount: number; lastSyncTime: string | null }>;

  /** Force a retry of the same probe; same behaviour as `check`. */
  retry(id: number): Promise<{ id: number; status: string; errorCount: number; lastSyncTime: string | null }>;

  /** Recent audit rows that mention this integration (max 20). */
  logs(id: number): Promise<
    { logId: number; action: string; details: string | null; timestamp: string }[]
  >;

  /** Dev-only: toggle eCourts outage simulation. Returns the new state. */
  simulateOutage(enabled: boolean): Promise<{ outage: boolean }>;
}

export function createIntegrationsService(options: {
  repos: Repositories;
  clock: Clock;
}): IntegrationsService {
  const { repos, clock } = options;
  const indiaCode = createMockIndiaCodeClient({ now: () => clock.nowIso() });

  return {
    async list() {
      const rows = await repos.integrations.list();
      return rows.map((row) => ({
        id: row.integration_id,
        managerId: row.manager_id,
        serviceName: row.service_name,
        status: row.status,
        lastSyncTime: row.last_sync_time,
        errorCount: row.error_count ?? 0,
      }));
    },

    async check(id) {
      const row = await repos.integrations.findById(id);
      if (!row) throw new Error(`Integration ${id} not found`);

      const at = clock.nowIso();
      let ok = false;

      if (id === 1) {
        // eCourts
        const client = getECourtsClient();
        try {
          await client.getCaseByCnr('RJJP010012342022');
          ok = true;
        } catch {
          ok = false;
        }
      } else if (id === 2) {
        // Gemini — in mock mode it never fails; in real mode the provider records its own health
        const provider = getAiProvider();
        ok = provider.demo || !isForceMockAi();
      } else if (id === 3) {
        // India Code (mock) — never fails
        ok = true;
      } else if (id === 4) {
        // OTP gateway (mock) — never fails
        ok = true;
      }

      if (ok) {
        await repos.integrations.recordSuccess(id, at);
      } else {
        await repos.integrations.recordFailure(id);
      }

      const updated = await repos.integrations.findById(id);
      return {
        id: updated!.integration_id,
        status: updated!.status,
        errorCount: updated!.error_count ?? 0,
        lastSyncTime: updated!.last_sync_time,
      };
    },

    async retry(id) {
      // Retry is the same as check for our mock adapters.
      return this.check(id);
    },

    async logs(id) {
      const rows = await repos.audit.listForIntegration(id);
      return rows.map((row) => ({
        logId: row.log_id,
        action: row.action,
        details: row.details,
        timestamp: row.timestamp,
      }));
    },

    async simulateOutage(enabled) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Outage simulation disabled in production');
      }
      setECourtsOutage(enabled);
      return { outage: enabled };
    },

    async simulateLegislativeChange(actorId, input, locale) {
      const validation = validateLegislativeChangeInput(
        input,
        createValidationContext(repos, clock, locale),
      );
      if (!validation.ok) throw validationFailed(validation.errors);

      const value = validation.value;
      let change: LegislativeChange;

      try {
        change = await indiaCode.simulateChange({
          category: value.category,
          changeSummary: value.change_summary,
          actName: value.act_name,
          effectiveFrom: value.effective_from,
        });
        await repos.integrations.recordSuccess(INDIA_CODE_INTEGRATION_ID, clock.nowIso());
      } catch (error) {
        await repos.integrations.recordFailure(INDIA_CODE_INTEGRATION_ID);
        throw error;
      }

      const at = clock.nowIso();
      const flagged = await repos.guides.flagValidByCategory(value.category, at);
      const curatorIds = await repos.users.idsByRole('Curator');

      const dictionary = getDictionary(locale);
      const message = formatMessage(dictionary.notifications.legislativeChange, {
        count: flagged.length,
        category: categoryLabel(dictionary, value.category),
      });

      for (const curatorId of curatorIds) {
        await repos.notifications.create({
          userId: curatorId,
          message: message.slice(0, 255),
          channel: 'In-App',
          status: 'Unread',
          timestamp: at,
        });
      }

      await repos.audit.record({
        performedBy: actorId,
        action: 'GUIDES_FLAGGED_LEGISLATIVE',
        details: {
          category: value.category,
          actName: value.act_name,
          changeSummary: value.change_summary,
          effectiveFrom: value.effective_from,
          flaggedGuideIds: flagged.map((row) => row.guide_id),
          notifiedCurators: curatorIds.length,
        },
        timestamp: at,
      });

      return {
        change,
        flaggedGuides: flagged.length,
        notifiedCurators: curatorIds.length,
      };
    },
  };
}
