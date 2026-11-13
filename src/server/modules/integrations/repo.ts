import 'server-only';

import type { Kysely, Selectable } from 'kysely';

import type { IntegrationStatus } from '../../../shared/enums';
import type { Database, ApiIntegrationTable } from '../../db/schema';

export type IntegrationRow = Selectable<ApiIntegrationTable>;

export interface NewIntegration {
  integrationId: number;
  managerId: number;
  serviceName: string;
  status?: IntegrationStatus;
  lastSyncTime?: string | null;
}

/**
 * Health ledger for the four external services (eCourts, Gemini, India Code,
 * OTP gateway). Rows are seeded with fixed ids 1–4 and never deleted.
 */
export function createIntegrationsRepo(db: Kysely<Database>) {
  return {
    async list(): Promise<IntegrationRow[]> {
      return db.selectFrom('API_Integration').selectAll().orderBy('integration_id', 'asc').execute();
    },

    async findById(id: number): Promise<IntegrationRow | undefined> {
      return db
        .selectFrom('API_Integration')
        .selectAll()
        .where('integration_id', '=', id)
        .executeTakeFirst();
    },

    async findByServiceName(serviceName: string): Promise<IntegrationRow | undefined> {
      return db
        .selectFrom('API_Integration')
        .selectAll()
        .where('service_name', '=', serviceName)
        .executeTakeFirst();
    },

    async insertSeed(input: NewIntegration): Promise<IntegrationRow> {
      const existing = await this.findById(input.integrationId);
      if (existing) return existing;

      return db
        .insertInto('API_Integration')
        .values({
          integration_id: input.integrationId,
          manager_id: input.managerId,
          service_name: input.serviceName,
          ...(input.status ? { status: input.status } : {}),
          last_sync_time: input.lastSyncTime ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async updateHealth(
      id: number,
      patch: { status: IntegrationStatus; errorCount: number; lastSyncTime?: string | null },
    ): Promise<void> {
      await db
        .updateTable('API_Integration')
        .set({
          status: patch.status,
          error_count: patch.errorCount,
          ...(patch.lastSyncTime !== undefined ? { last_sync_time: patch.lastSyncTime } : {}),
        })
        .where('integration_id', '=', id)
        .execute();
    },

    /** Success resets consecutive failures and marks the service Healthy. */
    async recordSuccess(id: number, at: string): Promise<void> {
      await db
        .updateTable('API_Integration')
        .set({ status: 'Healthy', error_count: 0, last_sync_time: at })
        .where('integration_id', '=', id)
        .execute();
    },

    /** Degraded at ≥1 consecutive failure, Down at ≥3 (AGENTS.md §6). */
    async recordFailure(id: number): Promise<{ status: IntegrationStatus; errorCount: number }> {
      const current = await db
        .selectFrom('API_Integration')
        .select(['error_count'])
        .where('integration_id', '=', id)
        .executeTakeFirst();

      const errorCount = Number(current?.error_count ?? 0) + 1;
      const status: IntegrationStatus = errorCount >= 3 ? 'Down' : 'Degraded';

      await db
        .updateTable('API_Integration')
        .set({ status, error_count: errorCount })
        .where('integration_id', '=', id)
        .execute();

      return { status, errorCount };
    },
  };
}

export type IntegrationsRepo = ReturnType<typeof createIntegrationsRepo>;
