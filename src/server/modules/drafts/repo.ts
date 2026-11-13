import 'server-only';

import type { Kysely, Selectable } from 'kysely';

import type { DraftDecision, DraftStatus, DraftType } from '../../../shared/enums';
import type {
  Database,
  DraftReviewTable,
  LegalDraftTable,
} from '../../db/schema';

export type DraftRow = Selectable<LegalDraftTable>;
export type DraftReviewRow = Selectable<DraftReviewTable>;

export interface NewDraft {
  citizenId: number;
  draftType: DraftType;
  formData: string;
  generatedText: string;
  status: DraftStatus;
  version: number;
  createdAt: string;
}

export type QueueRow = DraftRow & { citizen_name: string; review_count: number | null };

/**
 * Draft persistence (AGENTS.md §4 Legal_Draft / Draft_Review). SQL only: the
 * service owns transitions, ownership checks and notifications.
 */
export function createDraftsRepo(db: Kysely<Database>) {
  return {
    async create(input: NewDraft): Promise<DraftRow> {
      return db
        .insertInto('Legal_Draft')
        .values({
          citizen_id: input.citizenId,
          draft_type: input.draftType,
          form_data: input.formData,
          generated_text: input.generatedText,
          status: input.status,
          version: input.version,
          created_at: input.createdAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async findById(draftId: number): Promise<DraftRow | undefined> {
      return db
        .selectFrom('Legal_Draft')
        .selectAll()
        .where('draft_id', '=', draftId)
        .executeTakeFirst();
    },

    async findOwned(citizenId: number, draftId: number): Promise<DraftRow | undefined> {
      return db
        .selectFrom('Legal_Draft')
        .selectAll()
        .where('draft_id', '=', draftId)
        .where('citizen_id', '=', citizenId)
        .executeTakeFirst();
    },

    async listForCitizen(citizenId: number): Promise<DraftRow[]> {
      return db
        .selectFrom('Legal_Draft')
        .selectAll()
        .where('citizen_id', '=', citizenId)
        .orderBy('created_at', 'desc')
        .orderBy('draft_id', 'desc')
        .execute();
    },

    /** Shared lawyer queue: every draft awaiting review, oldest first. */
    async queue(): Promise<QueueRow[]> {
      return db
        .selectFrom('Legal_Draft')
        .innerJoin('Citizen', 'Citizen.user_id', 'Legal_Draft.citizen_id')
        .innerJoin('User', 'User.user_id', 'Citizen.user_id')
        .selectAll('Legal_Draft')
        .select((eb) => [
          eb.ref('User.name').as('citizen_name'),
          eb
            .selectFrom('Draft_Review')
            .select((inner) => inner.fn.countAll<number>().as('count'))
            .whereRef('Draft_Review.draft_id', '=', 'Legal_Draft.draft_id')
            .as('review_count'),
        ])
        .where('Legal_Draft.status', '=', 'Pending Review')
        .orderBy('Legal_Draft.created_at', 'asc')
        .orderBy('Legal_Draft.draft_id', 'asc')
        .execute();
    },

    async listQueueForCitizen(citizenId: number): Promise<DraftRow[]> {
      return db
        .selectFrom('Legal_Draft')
        .selectAll()
        .where('citizen_id', '=', citizenId)
        .where('status', '=', 'Pending Review')
        .orderBy('created_at', 'asc')
        .execute();
    },

    async updateStatus(
      draftId: number,
      status: DraftStatus,
      expected: DraftStatus,
    ): Promise<boolean> {
      const result = await db
        .updateTable('Legal_Draft')
        .set({ status })
        .where('draft_id', '=', draftId)
        .where('status', '=', expected)
        .executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0) > 0;
    },

    async replaceGenerated(
      draftId: number,
      input: { generatedText: string; version: number; status: DraftStatus; expected: DraftStatus },
    ): Promise<boolean> {
      const result = await db
        .updateTable('Legal_Draft')
        .set({
          generated_text: input.generatedText,
          version: input.version,
          status: input.status,
        })
        .where('draft_id', '=', draftId)
        .where('status', '=', input.expected)
        .executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0) > 0;
    },

    async addReview(input: {
      draftId: number;
      lawyerId: number;
      decision: DraftDecision;
      remarks: string | null;
      reviewedAt: string;
    }): Promise<DraftReviewRow> {
      return db
        .insertInto('Draft_Review')
        .values({
          draft_id: input.draftId,
          lawyer_id: input.lawyerId,
          decision: input.decision,
          remarks: input.remarks,
          reviewed_at: input.reviewedAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async listReviews(draftId: number): Promise<(DraftReviewRow & { lawyer_name: string })[]> {
      return db
        .selectFrom('Draft_Review')
        .innerJoin('User', 'User.user_id', 'Draft_Review.lawyer_id')
        .selectAll('Draft_Review')
        .select('User.name as lawyer_name')
        .where('draft_id', '=', draftId)
        .orderBy('review_id', 'asc')
        .execute();
    },

    async firstApproval(
      draftId: number,
    ): Promise<(DraftReviewRow & { lawyer_name: string }) | undefined> {
      return db
        .selectFrom('Draft_Review')
        .innerJoin('User', 'User.user_id', 'Draft_Review.lawyer_id')
        .selectAll('Draft_Review')
        .select('User.name as lawyer_name')
        .where('draft_id', '=', draftId)
        .where('decision', '=', 'Approved')
        .orderBy('review_id', 'asc')
        .executeTakeFirst();
    },

    async reviewCount(draftId: number): Promise<number> {
      const row = await db
        .selectFrom('Draft_Review')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .where('draft_id', '=', draftId)
        .executeTakeFirst();
      return Number(row?.total ?? 0);
    },
  };
}

export type DraftsRepo = ReturnType<typeof createDraftsRepo>;
