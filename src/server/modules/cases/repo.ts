import 'server-only';

import type { Kysely, Selectable } from 'kysely';

import type { CaseStatus } from '../../../shared/enums';
import type { Database, CourtCaseTable, HearingTable } from '../../db/schema';

export type CourtCaseRow = Selectable<CourtCaseTable>;
export type HearingRow = Selectable<HearingTable>;

export interface CaseUpsert {
  integrationId: number;
  cnr: string;
  title: string;
  courtName: string;
  status: CaseStatus;
  nextHearingDate: string | null;
  lastSyncedAt: string;
}

export interface HearingUpsert {
  date: string;
  purpose: string;
  orderSummary: string | null;
  orderUrl: string | null;
}

/**
 * Court case persistence (AGENTS.md §4, §6).
 *
 * `Court_Case.cnr_number` is unique, so a sync upserts by CNR and never creates
 * a second row for the same case. Hearings are replaced wholesale on each sync:
 * the adapter is the source of truth and the ER has no natural key for a
 * hearing.
 */
export function createCasesRepo(db: Kysely<Database>) {
  return {
    async findAll(): Promise<CourtCaseRow[]> {
      return db.selectFrom('Court_Case').selectAll().orderBy('case_id', 'asc').execute();
    },

    async findById(caseId: number): Promise<CourtCaseRow | undefined> {
      return db.selectFrom('Court_Case').selectAll().where('case_id', '=', caseId).executeTakeFirst();
    },

    async findByCnr(cnr: string): Promise<CourtCaseRow | undefined> {
      return db
        .selectFrom('Court_Case')
        .selectAll()
        .where('cnr_number', '=', cnr)
        .executeTakeFirst();
    },

    /** Insert-or-update keyed on the unique CNR. */
    async upsert(input: CaseUpsert): Promise<CourtCaseRow> {
      const existing = await this.findByCnr(input.cnr);
      if (existing) {
        await db
          .updateTable('Court_Case')
          .set({
            integration_id: input.integrationId,
            case_title: input.title,
            court_name: input.courtName,
            status: input.status,
            next_hearing_date: input.nextHearingDate,
            last_synced_at: input.lastSyncedAt,
          })
          .where('case_id', '=', existing.case_id)
          .execute();

        const updated = await this.findById(existing.case_id);
        if (!updated) throw new Error(`Court_Case ${existing.case_id} disappeared during upsert`);
        return updated;
      }

      return db
        .insertInto('Court_Case')
        .values({
          integration_id: input.integrationId,
          cnr_number: input.cnr,
          case_title: input.title,
          court_name: input.courtName,
          status: input.status,
          next_hearing_date: input.nextHearingDate,
          last_synced_at: input.lastSyncedAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    /** Replace the hearing history with the adapter's current view. */
    async replaceHearings(caseId: number, hearings: HearingUpsert[]): Promise<void> {
      await db.deleteFrom('Hearing').where('case_id', '=', caseId).execute();
      if (hearings.length === 0) return;

      await db
        .insertInto('Hearing')
        .values(
          hearings.map((hearing) => ({
            case_id: caseId,
            hearing_date: hearing.date,
            purpose: hearing.purpose,
            order_summary: hearing.orderSummary,
            order_url: hearing.orderUrl,
          })),
        )
        .execute();
    },

    async listHearings(caseId: number): Promise<HearingRow[]> {
      return db
        .selectFrom('Hearing')
        .selectAll()
        .where('case_id', '=', caseId)
        .orderBy('hearing_date', 'desc')
        .orderBy('hearing_id', 'desc')
        .execute();
    },

    /** Cases the citizen follows, newest subscription first. */
    async listTracked(citizenId: number): Promise<CourtCaseRow[]> {
      return db
        .selectFrom('Court_Case')
        .innerJoin('Case_Tracking', 'Case_Tracking.case_id', 'Court_Case.case_id')
        .selectAll('Court_Case')
        .where('Case_Tracking.citizen_id', '=', citizenId)
        .orderBy('Court_Case.next_hearing_date', 'asc')
        .orderBy('Court_Case.case_id', 'desc')
        .execute();
    },

    async isTracking(citizenId: number, caseId: number): Promise<boolean> {
      const row = await db
        .selectFrom('Case_Tracking')
        .select('case_id')
        .where('citizen_id', '=', citizenId)
        .where('case_id', '=', caseId)
        .executeTakeFirst();
      return row !== undefined;
    },

    /** Idempotent subscription: looking up the same case twice is safe. */
    async track(citizenId: number, caseId: number, at: string): Promise<void> {
      await db
        .insertInto('Case_Tracking')
        .values({ citizen_id: citizenId, case_id: caseId, subscribed_at: at })
        .onConflict((oc) => oc.columns(['citizen_id', 'case_id']).doNothing())
        .execute();
    },

    async untrack(citizenId: number, caseId: number): Promise<boolean> {
      const deleted = await db
        .deleteFrom('Case_Tracking')
        .where('citizen_id', '=', citizenId)
        .where('case_id', '=', caseId)
        .returning('case_id')
        .executeTakeFirst();
      return deleted !== undefined;
    },

    /** User ids subscribed to a case, used for change notifications. */
    async listSubscriberIds(caseId: number): Promise<number[]> {
      const rows = await db
        .selectFrom('Case_Tracking')
        .select('citizen_id')
        .where('case_id', '=', caseId)
        .execute();
      return rows.map((row) => row.citizen_id);
    },

    /** Every tracked case, for the background sync job. */
    async listTrackedCaseIds(): Promise<number[]> {
      const rows = await db.selectFrom('Case_Tracking').select('case_id').distinct().execute();
      return rows.map((row) => row.case_id);
    },
  };
}

export type CasesRepo = ReturnType<typeof createCasesRepo>;
