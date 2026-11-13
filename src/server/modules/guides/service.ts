import 'server-only';

import { CATEGORY_NAMES, type GuideStatus, type Language } from '../../../shared/enums';
import type { Locale } from '../../../i18n';
import type { SessionClaims } from '../../../shared/session';
import {
  canTransitionGuide,
  describe,
  validateGuideFlagInput,
  validateGuideUpdate,
  type GuideUpdateInput,
} from '../../../shared/validation';
import type { Repositories } from '../../db/repositories';
import type { Clock } from '../../lib/clock';
import { AppError, notFound, validationFailed } from '../../lib/errors';
import { createMockAiProvider } from '../../adapters/ai/mock';
import type { AiProvider } from '../../adapters/ai/provider';
import type { GuideRow } from './repo';

/**
 * Knowledge-base business rules (AGENTS.md §6).
 *
 * Citizens and anonymous visitors only ever see `Valid` guides. Curators see
 * every status, edit content, and move a guide through the explicit
 * validate/flag transitions. Every privileged action writes an audit row and
 * keeps the lexical embedding index in sync.
 */

export interface GuideDto {
  id: number;
  title: string;
  category: string;
  summary: string;
  statute: string;
  language: Language;
  status: GuideStatus;
  lastUpdated: string;
  sourceExcerpt: string | null;
  topicKey: string | null;
  curatorId: number | null;
}

export interface GuideLanguageLink {
  id: number;
  title: string;
  language: Language;
}

export interface GuideDetailDto extends GuideDto {
  alternate: GuideLanguageLink | null;
}

export interface GuideListDto {
  items: GuideDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GuideCategoryCount {
  category: string;
  count: number;
}

export interface GuideFilterInput {
  category?: string;
  query?: string;
  language?: Language;
  status?: GuideStatus;
  page?: string | number | null;
  pageSize?: string | number | null;
}

export interface GuideService {
  listPublic(filter: GuideFilterInput): Promise<GuideListDto>;
  detailPublic(
    guideId: number,
    viewer?: Pick<SessionClaims, 'sub' | 'role'> | null,
  ): Promise<GuideDetailDto>;
  categories(language?: Language): Promise<GuideCategoryCount[]>;
  lastViewed(citizenId: number): Promise<GuideDto | null>;
  listForCurator(filter: GuideFilterInput): Promise<GuideListDto>;
  statusCounts(): Promise<Record<GuideStatus, number>>;
  getForCurator(guideId: number): Promise<GuideDetailDto>;
  updateGuide(
    actorId: number,
    guideId: number,
    input: unknown,
    locale: Locale,
  ): Promise<GuideDto>;
  resimplifyGuide(guideId: number, locale: Locale): Promise<{
    guideId: number;
    text: string;
    model: string;
    demo: boolean;
  }>;
  validateGuide(actorId: number, guideId: number, locale: Locale): Promise<GuideDto>;
  flagGuide(
    actorId: number,
    guideId: number,
    input: unknown,
    locale: Locale,
  ): Promise<GuideDto>;
}

function toDto(row: GuideRow): GuideDto {
  return {
    id: row.guide_id,
    title: row.title,
    category: row.category,
    summary: row.plain_summary,
    statute: row.source_statute,
    language: row.language,
    status: row.validation_status,
    lastUpdated: row.last_updated,
    sourceExcerpt: row.source_excerpt,
    topicKey: row.topic_key,
    curatorId: row.curator_id,
  };
}

function toList(
  result: { items: GuideRow[]; total: number; page: { page: number; pageSize: number } },
): GuideListDto {
  return {
    items: result.items.map(toDto),
    total: result.total,
    page: result.page.page,
    pageSize: result.page.pageSize,
    totalPages: Math.max(1, Math.ceil(result.total / result.page.pageSize)),
  };
}

export function createGuidesService(options: {
  repos: Repositories;
  clock: Clock;
  ai?: AiProvider;
}): GuideService {
  const { repos, clock } = options;
  const ai = options.ai ?? createMockAiProvider();

  async function audit(actorId: number, action: string, details: unknown): Promise<void> {
    await repos.audit.record({
      performedBy: actorId,
      action,
      details,
      timestamp: clock.nowIso(),
    });
  }

  async function refreshEmbedding(row: GuideRow): Promise<void> {
    const text = [row.title, row.plain_summary, row.source_statute, row.source_excerpt ?? '']
      .filter(Boolean)
      .join('\n');
    const embedding = await ai.embed([text], { purpose: 'document' });
    const vector = embedding.vectors[0];
    if (!vector) throw new AppError('AI_UNAVAILABLE', 'The AI service returned no embedding.');

    await repos.guides.upsertEmbedding({
      guideId: row.guide_id,
      model: embedding.model,
      vector: JSON.stringify(vector),
      at: clock.nowIso(),
    });
  }

  function transitionError(from: GuideStatus, to: GuideStatus, locale: Locale): AppError {
    return new AppError(
      'INVALID_TRANSITION',
      describe(locale, 'guideTransitionInvalid', { from, to }),
    );
  }

  async function requireGuide(guideId: number, locale: Locale): Promise<GuideRow> {
    const row = await repos.guides.findById(guideId);
    if (!row) throw new AppError('NOT_FOUND', describe(locale, 'guideNotFound'));
    return row;
  }

  return {
    async listPublic(filter) {
      const result = await repos.guides.list({
        category: filter.category,
        query: filter.query,
        language: filter.language,
        status: 'Valid',
        page: filter.page,
        pageSize: filter.pageSize,
      });
      return toList(result);
    },

    async detailPublic(guideId, viewer) {
      const row = await repos.guides.findPublishedById(guideId);
      if (!row) throw notFound('Guide not found');

      let alternate: GuideLanguageLink | null = null;
      if (row.topic_key) {
        const otherLanguage: Language = row.language === 'English' ? 'Hindi' : 'English';
        const candidate = await repos.guides.findAlternateByTopic(
          row.topic_key,
          otherLanguage,
          row.guide_id,
        );
        if (candidate?.validation_status === 'Valid') {
          alternate = {
            id: candidate.guide_id,
            title: candidate.title,
            language: candidate.language,
          };
        }
      }

      if (viewer?.role === 'Citizen') {
        const citizenId = Number(viewer.sub);
        if (await repos.users.findCitizen(citizenId)) {
          await repos.guides.recordView(citizenId, row.guide_id, clock.nowIso());
        }
      }

      return { ...toDto(row), alternate };
    },

    async categories(language) {
      const rows = await repos.guides.categories(language);
      const counts = new Map(rows.map((row) => [row.category, row.count]));
      const known = CATEGORY_NAMES.map((category) => ({
        category,
        count: counts.get(category) ?? 0,
      }));
      const extras = rows
        .filter((row) => !(CATEGORY_NAMES as readonly string[]).includes(row.category))
        .map((row) => ({ category: row.category, count: row.count }));
      return [...known, ...extras];
    },

    async lastViewed(citizenId) {
      const row = await repos.guides.findLastViewed(citizenId);
      return row ? toDto(row) : null;
    },

    async listForCurator(filter) {
      const result = await repos.guides.list({
        category: filter.category,
        query: filter.query,
        language: filter.language,
        status: filter.status,
        page: filter.page,
        pageSize: filter.pageSize,
      });
      return toList(result);
    },

    async statusCounts() {
      return repos.guides.statusCounts();
    },

    async getForCurator(guideId) {
      const row = await requireGuide(guideId, 'en');
      let alternate: GuideLanguageLink | null = null;
      if (row.topic_key) {
        const otherLanguage: Language = row.language === 'English' ? 'Hindi' : 'English';
        const candidate = await repos.guides.findAlternateByTopic(
          row.topic_key,
          otherLanguage,
          row.guide_id,
        );
        if (candidate) {
          alternate = {
            id: candidate.guide_id,
            title: candidate.title,
            language: candidate.language,
          };
        }
      }
      return { ...toDto(row), alternate };
    },

    async updateGuide(actorId, guideId, input, locale) {
      const row = await requireGuide(guideId, locale);
      const validation = validateGuideUpdate(input, {
        clock,
        locale,
        exists: async () => true,
        isUnique: async () => true,
      });
      if (!validation.ok) throw validationFailed(validation.errors);

      const patch = validation.value as GuideUpdateInput;
      if (Object.keys(patch).length === 0) return toDto(row);

      await repos.guides.updateForCurator(guideId, {
        title: patch.title,
        category: patch.category,
        plainSummary: patch.plain_summary,
        sourceStatute: patch.source_statute,
        sourceExcerpt: patch.source_excerpt,
        lastUpdated: clock.nowIso(),
      });

      const updated = await requireGuide(guideId, locale);
      if (updated.validation_status === 'Valid') {
        await refreshEmbedding(updated);
      } else {
        await repos.guides.deleteEmbedding(guideId);
      }

      await audit(actorId, 'GUIDE_EDITED', {
        guideId,
        fields: Object.keys(patch),
      });

      return toDto(updated);
    },

    async resimplifyGuide(guideId, locale) {
      const row = await requireGuide(guideId, locale);
      const suggestion = await ai.simplifyText(row.plain_summary, row.language);
      return { guideId, ...suggestion };
    },

    async validateGuide(actorId, guideId, locale) {
      const row = await requireGuide(guideId, locale);
      if (row.validation_status === 'Valid') {
        await refreshEmbedding(row);
        return toDto(row);
      }
      if (!canTransitionGuide(row.validation_status, 'Valid')) {
        throw transitionError(row.validation_status, 'Valid', locale);
      }

      await repos.guides.markValidated(guideId, actorId, clock.nowIso());
      await repos.guides.incrementCuratorValidatedCount(actorId);
      const updated = await requireGuide(guideId, locale);
      await refreshEmbedding(updated);
      await audit(actorId, 'GUIDE_VALIDATED', { guideId });

      return toDto(updated);
    },

    async flagGuide(actorId, guideId, input, locale) {
      const row = await requireGuide(guideId, locale);
      if (row.validation_status === 'Requires AI Update') return toDto(row);
      if (row.validation_status !== 'Valid') {
        throw transitionError(row.validation_status, 'Requires AI Update', locale);
      }

      const validation = validateGuideFlagInput(input, {
        clock,
        locale,
        exists: async () => true,
        isUnique: async () => true,
      });
      if (!validation.ok) throw validationFailed(validation.errors);

      await repos.guides.updateForCurator(guideId, {
        validationStatus: 'Requires AI Update',
        lastUpdated: clock.nowIso(),
      });
      await repos.guides.deleteEmbedding(guideId);
      const updated = await requireGuide(guideId, locale);
      await audit(actorId, 'GUIDE_FLAGGED', {
        guideId,
        reason: validation.value.reason,
      });

      return toDto(updated);
    },
  };
}
