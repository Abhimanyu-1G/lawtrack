import 'server-only';

import type { Kysely, Selectable } from 'kysely';

import { normalisePagination, type PageParams } from '../../db/query';
import type { AuditLogTable, Database } from '../../db/schema';

export type AuditRow = Selectable<AuditLogTable>;

export interface AuditFilter {
  actorId?: number;
  action?: string;
  from?: string;
  to?: string;
  page?: string | number | null;
  pageSize?: string | number | null;
  /** `null` disables the page limit (CSV export); omitted uses the page size. */
  limit?: number | null;
}

/**
 * Append-only audit trail. Every privileged action (role change, user
 * creation, guide validation, draft decision, settings change, manual API
 * retry) writes exactly one row through this repo.
 */
export function createAuditRepo(db: Kysely<Database>) {
  return {
    async record(input: {
      performedBy: number;
      action: string;
      details?: unknown;
      timestamp: string;
    }): Promise<void> {
      await db
        .insertInto('Audit_Log')
        .values({
          performed_by: input.performedBy,
          action: input.action,
          details: input.details === undefined ? null : JSON.stringify(input.details),
          timestamp: input.timestamp,
        })
        .execute();
    },

    /** Rows for a fixed set of actions since a timestamp (Phase 7 metrics). */
    async listByActions(actions: string[], since: string): Promise<AuditRow[]> {
      if (actions.length === 0) return [];
      return db
        .selectFrom('Audit_Log')
        .selectAll()
        .where('action', 'in', actions)
        .where('timestamp', '>=', since)
        .orderBy('timestamp', 'asc')
        .execute();
    },

    /** Recent audit rows whose JSON details mention an integration id. */
    async listForIntegration(integrationId: number, limit = 20): Promise<AuditRow[]> {
      return db
        .selectFrom('Audit_Log')
        .selectAll()
        .where('details', 'like', `%"integrationId":${integrationId}%`)
        .orderBy('timestamp', 'desc')
        .orderBy('log_id', 'desc')
        .limit(limit)
        .execute();
    },

    async list(filter: AuditFilter = {}): Promise<{ items: AuditRow[]; total: number; page: PageParams }> {
      const page = normalisePagination(filter.page, filter.pageSize);

      let base = db.selectFrom('Audit_Log');
      if (filter.actorId !== undefined) base = base.where('performed_by', '=', filter.actorId);
      if (filter.action) base = base.where('action', 'like', `%${filter.action}%`);
      if (filter.from) base = base.where('timestamp', '>=', filter.from);
      if (filter.to) base = base.where('timestamp', '<=', filter.to);

      const items = await base
        .selectAll()
        .orderBy('timestamp', 'desc')
        .orderBy('log_id', 'desc')
        .limit(page.pageSize)
        .offset(page.offset)
        .execute();

      const countRow = await base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirst();

      return { items, total: Number(countRow?.total ?? 0), page };
    },

    /** Same filters as `list`, joined with the actor for the admin viewer. */
    async listWithActor(filter: AuditFilter = {}): Promise<{
      items: (AuditRow & { actor_name: string; actor_email: string; actor_role: string })[];
      total: number;
      page: PageParams;
      limit: number | null;
    }> {
      const page = normalisePagination(filter.page, filter.pageSize);

      let base = db
        .selectFrom('Audit_Log')
        .innerJoin('User', 'User.user_id', 'Audit_Log.performed_by');
      if (filter.actorId !== undefined) base = base.where('Audit_Log.performed_by', '=', filter.actorId);
      if (filter.action) base = base.where('Audit_Log.action', 'like', `%${filter.action}%`);
      if (filter.from) base = base.where('Audit_Log.timestamp', '>=', filter.from);
      if (filter.to) base = base.where('Audit_Log.timestamp', '<=', filter.to);

      // `limit` is null for the CSV export, which must contain every match.
      const limit = filter.limit === undefined ? page.pageSize : filter.limit;
      let rows = base.select([
        'Audit_Log.log_id',
        'Audit_Log.performed_by',
        'Audit_Log.action',
        'Audit_Log.details',
        'Audit_Log.timestamp',
        'User.name as actor_name',
        'User.email as actor_email',
        'User.role as actor_role',
      ]);
      if (limit !== null) rows = rows.limit(limit).offset(page.offset);

      const items = await rows.orderBy('Audit_Log.timestamp', 'desc').orderBy('Audit_Log.log_id', 'desc').execute();

      const countRow = await base
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .executeTakeFirst();

      return { items, total: Number(countRow?.total ?? 0), page, limit };
    },

    /** Distinct action names for the filter dropdown. */
    async distinctActions(): Promise<string[]> {
      const rows = await db
        .selectFrom('Audit_Log')
        .select('action')
        .distinct()
        .orderBy('action', 'asc')
        .execute();
      return rows.map((row) => row.action);
    },
  };
}

export type AuditRepo = ReturnType<typeof createAuditRepo>;
