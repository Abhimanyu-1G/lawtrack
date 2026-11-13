import 'server-only';

import type { Kysely, Selectable } from 'kysely';

import type { Database, MetricEventTable } from '../../db/schema';

export type MetricEventRow = Selectable<MetricEventTable>;

/**
 * Metric_Event persistence (AGENTS.md §14).
 *
 * Append-only rows power the admin dashboards (chat latency, grounding,
 * CSAT, sync success) and also serve as a small event log for idempotent
 * actions such as "ask a lawyer", which must notify a lawyer only once per
 * chat session.
 */
export function createMetricsRepo(db: Kysely<Database>) {
  return {
    async record(input: {
      metric: string;
      value: number;
      refId?: string | null;
      at: string;
    }): Promise<void> {
      await db
        .insertInto('Metric_Event')
        .values({
          metric: input.metric,
          value: input.value,
          ref_id: input.refId ?? null,
          created_at: input.at,
        })
        .execute();
    },

    /** Keep exactly one row per (metric, ref_id) — used for ratings/escalations. */
    async upsert(input: {
      metric: string;
      value: number;
      refId: string;
      at: string;
    }): Promise<void> {
      await db
        .deleteFrom('Metric_Event')
        .where('metric', '=', input.metric)
        .where('ref_id', '=', input.refId)
        .execute();

      await db
        .insertInto('Metric_Event')
        .values({
          metric: input.metric,
          value: input.value,
          ref_id: input.refId,
          created_at: input.at,
        })
        .execute();
    },

    async findForRef(metric: string, refId: string): Promise<MetricEventRow | undefined> {
      return db
        .selectFrom('Metric_Event')
        .selectAll()
        .where('metric', '=', metric)
        .where('ref_id', '=', refId)
        .orderBy('metric_id', 'desc')
        .executeTakeFirst();
    },

    async listSince(metric: string, since: string): Promise<MetricEventRow[]> {
      return db
        .selectFrom('Metric_Event')
        .selectAll()
        .where('metric', '=', metric)
        .where('created_at', '>=', since)
        .orderBy('created_at', 'asc')
        .execute();
    },

    /** Draft reviews joined with the draft's creation time (Phase 7 metrics). */
    async reviewsSince(since: string): Promise<
      {
        draft_id: number;
        decision: string;
        reviewed_at: string;
        created_at: string;
        version: number;
      }[]
    > {
      return db
        .selectFrom('Draft_Review')
        .innerJoin('Legal_Draft', 'Legal_Draft.draft_id', 'Draft_Review.draft_id')
        .select([
          'Draft_Review.draft_id as draft_id',
          'Draft_Review.decision as decision',
          'Draft_Review.reviewed_at as reviewed_at',
          'Legal_Draft.created_at as created_at',
          'Legal_Draft.version as version',
        ])
        .where('Draft_Review.reviewed_at', '>=', since)
        .orderBy('Draft_Review.reviewed_at', 'asc')
        .execute();
    },

    /** Number of drafts created in the range (regeneration denominator). */
    async draftCountSince(since: string): Promise<number> {
      const row = await db
        .selectFrom('Legal_Draft')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .where('created_at', '>=', since)
        .executeTakeFirst();
      return Number(row?.total ?? 0);
    },

    /** All rows for one metric whose ref id starts with a prefix. */
    async listByRefPrefix(metric: string, prefix: string): Promise<MetricEventRow[]> {
      return db
        .selectFrom('Metric_Event')
        .selectAll()
        .where('metric', '=', metric)
        .where('ref_id', 'like', `${prefix}%`)
        .orderBy('created_at', 'desc')
        .execute();
    },
  };
}

export type MetricsRepo = ReturnType<typeof createMetricsRepo>;
