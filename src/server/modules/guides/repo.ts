import 'server-only';

import type { Kysely, Selectable } from 'kysely';

import type { GuideStatus, Language } from '../../../shared/enums';
import { normalisePagination, type PageParams } from '../../db/query';
import type { Database, LegalGuideTable } from '../../db/schema';

export type GuideRow = Selectable<LegalGuideTable>;

export interface GuideFilter {
  category?: string;
  /** Free-text search over title + summary. */
  query?: string;
  language?: Language;
  status?: GuideStatus | GuideStatus[];
  page?: string | number | null;
  pageSize?: string | number | null;
}

export interface GuideListResult {
  items: GuideRow[];
  total: number;
  page: PageParams;
}

export interface NewGuide {
  curatorId?: number | null;
  title: string;
  category: string;
  plainSummary: string;
  sourceStatute: string;
  language: Language;
  validationStatus?: GuideStatus;
  lastUpdated: string;
  sourceExcerpt?: string | null;
  topicKey?: string | null;
}

/** Knowledge-base persistence. Authorization lives in services. */
export function createGuidesRepo(db: Kysely<Database>) {
  return {
    async list(filter: GuideFilter = {}): Promise<GuideListResult> {
      const page = normalisePagination(filter.page, filter.pageSize);

      let base = db.selectFrom('Legal_Guide');
      if (filter.category) base = base.where('category', '=', filter.category);
      if (filter.language) base = base.where('language', '=', filter.language);
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        base = base.where('validation_status', 'in', statuses);
      }
      if (filter.query?.trim()) {
        const pattern = `%${filter.query.trim()}%`;
        base = base.where((eb) =>
          eb.or([eb('title', 'like', pattern), eb('plain_summary', 'like', pattern)]),
        );
      }

      const items = await base
        .selectAll()
        .orderBy('last_updated', 'desc')
        .orderBy('guide_id', 'desc')
        .limit(page.pageSize)
        .offset(page.offset)
        .execute();

      const countRow = await base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirst();

      return { items, total: Number(countRow?.total ?? 0), page };
    },

    async findById(guideId: number): Promise<GuideRow | undefined> {
      return db.selectFrom('Legal_Guide').selectAll().where('guide_id', '=', guideId).executeTakeFirst();
    },

    async findPublishedById(guideId: number): Promise<GuideRow | undefined> {
      return db
        .selectFrom('Legal_Guide')
        .selectAll()
        .where('guide_id', '=', guideId)
        .where('validation_status', '=', 'Valid')
        .executeTakeFirst();
    },

    /** The RAG corpus: only curator-validated guides in the requested language. */
    async listValidByLanguage(language: Language, limit = 500): Promise<GuideRow[]> {
      return db
        .selectFrom('Legal_Guide')
        .selectAll()
        .where('validation_status', '=', 'Valid')
        .where('language', '=', language)
        .orderBy('guide_id', 'asc')
        .limit(limit)
        .execute();
    },

    /** Published guides plus their stored vector (RAG retrieval). */
    async listValidWithEmbeddings(
      language: Language,
      limit = 500,
    ): Promise<(GuideRow & { embedding_model: string | null; embedding_vector: string | null })[]> {
      return db
        .selectFrom('Legal_Guide')
        .leftJoin('Guide_Embedding', 'Guide_Embedding.guide_id', 'Legal_Guide.guide_id')
        .selectAll('Legal_Guide')
        .select((eb) => [
          eb.ref('Guide_Embedding.model').as('embedding_model'),
          eb.ref('Guide_Embedding.vector').as('embedding_vector'),
        ])
        .where('Legal_Guide.validation_status', '=', 'Valid')
        .where('Legal_Guide.language', '=', language)
        .orderBy('Legal_Guide.guide_id', 'asc')
        .limit(limit)
        .execute();
    },

    async findByIds(guideIds: number[]): Promise<GuideRow[]> {
      if (guideIds.length === 0) return [];
      return db
        .selectFrom('Legal_Guide')
        .selectAll()
        .where('guide_id', 'in', guideIds)
        .execute();
    },

    /**
     * UC-05: a legislative change flags every published guide in a topic. The
     * guides drop out of public search and the RAG corpus until re-validated.
     */
    async flagValidByCategory(category: string, at: string): Promise<GuideRow[]> {
      return db
        .updateTable('Legal_Guide')
        .set({ validation_status: 'Requires AI Update', last_updated: at })
        .where('category', '=', category)
        .where('validation_status', '=', 'Valid')
        .returningAll()
        .execute();
    },

    /** Guide ids for embedding refreshes (curator validate path). */
    async listPublishedIds(): Promise<number[]> {
      const rows = await db
        .selectFrom('Legal_Guide')
        .select('guide_id')
        .where('validation_status', '=', 'Valid')
        .execute();
      return rows.map((row) => row.guide_id);
    },

    async categories(language?: Language): Promise<{ category: string; count: number }[]> {
      let base = db.selectFrom('Legal_Guide').where('validation_status', '=', 'Valid');
      if (language) base = base.where('language', '=', language);

      const rows = await base
        .select((eb) => ['category', eb.fn.countAll<number>().as('count')])
        .groupBy('category')
        .orderBy('category', 'asc')
        .execute();

      return rows.map((row) => ({ category: row.category, count: Number(row.count) }));
    },

    /** Every category in use, regardless of validation status (admin editor). */
    async categoryCounts(): Promise<{ category: string; count: number }[]> {
      const rows = await db
        .selectFrom('Legal_Guide')
        .select((eb) => ['category', eb.fn.countAll<number>().as('count')])
        .groupBy('category')
        .orderBy('category', 'asc')
        .execute();

      return rows.map((row) => ({ category: row.category, count: Number(row.count) }));
    },

    /**
     * Seed helper: inserts a guide unless a guide with the same title/language
     * already exists. `DO NOTHING` keeps curator edits safe across re-seeds.
     */
    async insertSeedGuide(input: NewGuide): Promise<{ row: GuideRow; created: boolean }> {
      const existing = await db
        .selectFrom('Legal_Guide')
        .selectAll()
        .where('title', '=', input.title)
        .where('language', '=', input.language)
        .executeTakeFirst();

      if (existing) return { row: existing, created: false };

      const row = await db
        .insertInto('Legal_Guide')
        .values({
          curator_id: input.curatorId ?? null,
          title: input.title,
          category: input.category,
          plain_summary: input.plainSummary,
          source_statute: input.sourceStatute,
          language: input.language,
          ...(input.validationStatus ? { validation_status: input.validationStatus } : {}),
          last_updated: input.lastUpdated,
          source_excerpt: input.sourceExcerpt ?? null,
          topic_key: input.topicKey ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return { row, created: true };
    },

    async updateForCurator(
      guideId: number,
      patch: {
        title?: string;
        category?: string;
        plainSummary?: string;
        sourceStatute?: string;
        sourceExcerpt?: string | null;
        validationStatus?: GuideStatus;
        lastUpdated?: string;
        topicKey?: string | null;
      },
    ): Promise<void> {
      const values: {
        title?: string;
        category?: string;
        plain_summary?: string;
        source_statute?: string;
        source_excerpt?: string | null;
        validation_status?: GuideStatus;
        last_updated?: string;
        topic_key?: string | null;
      } = {};
      if (patch.title !== undefined) values.title = patch.title;
      if (patch.category !== undefined) values.category = patch.category;
      if (patch.plainSummary !== undefined) values.plain_summary = patch.plainSummary;
      if (patch.sourceStatute !== undefined) values.source_statute = patch.sourceStatute;
      if (patch.sourceExcerpt !== undefined) values.source_excerpt = patch.sourceExcerpt;
      if (patch.validationStatus !== undefined) values.validation_status = patch.validationStatus;
      if (patch.lastUpdated !== undefined) values.last_updated = patch.lastUpdated;
      if (patch.topicKey !== undefined) values.topic_key = patch.topicKey;
      if (Object.keys(values).length === 0) return;

      await db.updateTable('Legal_Guide').set(values).where('guide_id', '=', guideId).execute();
    },

    async markValidated(guideId: number, curatorId: number, at: string): Promise<void> {
      await db
        .updateTable('Legal_Guide')
        .set({ validation_status: 'Valid', curator_id: curatorId, last_updated: at })
        .where('guide_id', '=', guideId)
        .execute();
    },

    async incrementCuratorValidatedCount(curatorId: number): Promise<void> {
      await db
        .updateTable('Content_Curator')
        .set((eb) => ({ validated_count: eb('validated_count', '+', 1) }))
        .where('user_id', '=', curatorId)
        .execute();
    },

    async setCuratorValidatedCount(curatorId: number, count: number): Promise<void> {
      await db
        .updateTable('Content_Curator')
        .set({ validated_count: Math.max(0, count) })
        .where('user_id', '=', curatorId)
        .execute();
    },

    async countValidByCurator(curatorId: number): Promise<number> {
      const row = await db
        .selectFrom('Legal_Guide')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .where('curator_id', '=', curatorId)
        .where('validation_status', '=', 'Valid')
        .executeTakeFirst();
      return Number(row?.total ?? 0);
    },

    /** Exact counterpart in the other language, for the guide language switch. */
    async findAlternateByTopic(
      topicKey: string,
      language: Language,
      excludeGuideId: number,
    ): Promise<GuideRow | undefined> {
      return db
        .selectFrom('Legal_Guide')
        .selectAll()
        .where('topic_key', '=', topicKey)
        .where('language', '=', language)
        .where('guide_id', '!=', excludeGuideId)
        .executeTakeFirst();
    },

    async statusCounts(): Promise<Record<GuideStatus, number>> {
      const rows = await db
        .selectFrom('Legal_Guide')
        .select((eb) => ['validation_status', eb.fn.countAll<number>().as('count')])
        .groupBy('validation_status')
        .execute();

      const counts: Record<GuideStatus, number> = { Draft: 0, Valid: 0, 'Requires AI Update': 0 };
      for (const row of rows) counts[row.validation_status] = Number(row.count);
      return counts;
    },

    /** Record a citizen's guide view and remember it for "continue reading". */
    async recordView(citizenId: number, guideId: number, at: string): Promise<void> {
      await db
        .insertInto('Guide_View')
        .values({ citizen_id: citizenId, guide_id: guideId, viewed_at: at })
        .onConflict((oc) =>
          oc.columns(['citizen_id', 'guide_id', 'viewed_at']).doNothing(),
        )
        .execute();

      await db
        .updateTable('Citizen')
        .set({ last_viewed_guide_id: guideId })
        .where('user_id', '=', citizenId)
        .execute();
    },

    async findLastViewed(citizenId: number): Promise<GuideRow | undefined> {
      return db
        .selectFrom('Citizen')
        .innerJoin('Legal_Guide', 'Legal_Guide.guide_id', 'Citizen.last_viewed_guide_id')
        .selectAll('Legal_Guide')
        .where('Citizen.user_id', '=', citizenId)
        .where('Legal_Guide.validation_status', '=', 'Valid')
        .executeTakeFirst();
    },

    async upsertEmbedding(input: {
      guideId: number;
      model: string;
      vector: string;
      at: string;
    }): Promise<void> {
      await db
        .insertInto('Guide_Embedding')
        .values({
          guide_id: input.guideId,
          model: input.model,
          vector: input.vector,
          updated_at: input.at,
        })
        .onConflict((oc) =>
          oc.column('guide_id').doUpdateSet({
            model: input.model,
            vector: input.vector,
            updated_at: input.at,
          }),
        )
        .execute();
    },

    /** Drop a stale vector after an edit; validation recomputes it. */
    async deleteEmbedding(guideId: number): Promise<void> {
      await db.deleteFrom('Guide_Embedding').where('guide_id', '=', guideId).execute();
    },
  };
}

export type GuidesRepo = ReturnType<typeof createGuidesRepo>;
