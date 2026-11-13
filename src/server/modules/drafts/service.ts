import 'server-only';

import {
  formatMessage,
  getDictionary,
  type Dictionary,
  type Locale,
} from '../../../i18n';
import type { DraftStatus, DraftType, LawyerStatus } from '../../../shared/enums';
import { LAWYER_STATUSES } from '../../../shared/enums';
import {
  canDecide,
  validateDraftFormInput,
  validateReviewRemarks,
  type DraftAnswers,
} from '../../../shared/validation';
import type { AiProvider } from '../../adapters/ai/provider';
import type { Repositories } from '../../db/repositories';
import type { Clock } from '../../lib/clock';
import { AppError, notFound, validationFailed } from '../../lib/errors';
import { renderDraftPdf } from '../../lib/pdf';
import type { DraftRow } from './repo';

/**
 * Draft lifecycle (AGENTS.md §6 Legal_Draft, §9, §13).
 *
 *   create → AI generate → Pending Review (v1) → notify lawyers
 *   Pending Review ─approve→ Approved (terminal, PDF unlocked)
 *   Pending Review ─reject(remarks ≥10)─→ Rejected → regenerate → v+1 Pending Review
 *
 * Ownership is checked on every citizen call, lawyers share one queue and claim
 * a draft for 15 minutes when they open it, and a citizen never receives the
 * generated text until the draft is Approved.
 */

const CLAIM_KEY = 'draft_review_claims';
const CLAIM_TTL_MS = 15 * 60 * 1000;
const SLA_HOURS = 24;
const PREVIEW_CHARS = 140;

interface Claim {
  lawyerId: number;
  expiresAt: string;
}

type Claims = Record<string, Claim>;

export interface DraftTimelineEntryDto {
  kind: 'submitted' | 'approved' | 'rejected' | 'regenerated';
  at: string;
  remarks: string | null;
  version: number | null;
  actorName: string | null;
}

export interface DraftSummaryDto {
  id: number;
  type: DraftType;
  status: DraftStatus;
  version: number;
  createdAt: string;
  preview: string;
  rejectionCount: number;
}

export interface DraftDetailDto extends DraftSummaryDto {
  answers: DraftAnswers;
  /** Non-null only for an Approved draft; citizens never see pending text. */
  generatedText: string | null;
  timeline: DraftTimelineEntryDto[];
  approval: { lawyerName: string; approvedAt: string } | null;
  pdfAvailable: boolean;
}

export interface ReviewQueueItemDto {
  id: number;
  type: DraftType;
  version: number;
  citizenName: string;
  createdAt: string;
  ageHours: number;
  slaDueAt: string;
  overdue: boolean;
  reviewCount: number;
  claimedBy: string | null;
}

export interface ReviewDetailDto {
  id: number;
  type: DraftType;
  status: DraftStatus;
  version: number;
  createdAt: string;
  citizenName: string;
  answers: DraftAnswers;
  generatedText: string;
  reviews: {
    decision: 'Approved' | 'Rejected';
    remarks: string | null;
    reviewedAt: string;
    lawyerName: string;
  }[];
  claimedBy: string | null;
  claimedUntil: string | null;
  claimedByMe: boolean;
}

export interface DraftService {
  readonly demoMode: boolean;
  createDraft(citizenId: number, input: unknown, locale: Locale): Promise<DraftDetailDto>;
  listForCitizen(citizenId: number): Promise<DraftSummaryDto[]>;
  getForCitizen(citizenId: number, draftId: number, locale: Locale): Promise<DraftDetailDto>;
  submitForReview(citizenId: number, draftId: number, locale: Locale): Promise<DraftDetailDto>;
  regenerate(citizenId: number, draftId: number, locale: Locale): Promise<DraftDetailDto>;
  exportPDF(
    citizenId: number,
    draftId: number,
    locale: Locale,
  ): Promise<{ bytes: Uint8Array; fileName: string }>;
  queue(lawyerId: number): Promise<ReviewQueueItemDto[]>;
  getForReview(lawyerId: number, draftId: number, locale: Locale): Promise<ReviewDetailDto>;
  approve(lawyerId: number, draftId: number, locale: Locale): Promise<DraftDetailDto>;
  reject(
    lawyerId: number,
    draftId: number,
    input: unknown,
    locale: Locale,
  ): Promise<{ draft: DraftDetailDto; regenerationFailed: boolean }>;
  setLawyerStatus(
    lawyerId: number,
    input: unknown,
    locale: Locale,
  ): Promise<{ status: LawyerStatus }>;
  /** Remove expired 15-minute review claims (background job, §12). */
  releaseExpiredClaims(): Promise<number>;
}

function truncate(value: string, max = PREVIEW_CHARS): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function parseAnswers(formData: string): DraftAnswers {
  try {
    const parsed: unknown = JSON.parse(formData);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const answers: DraftAnswers = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        answers[key] = value;
      }
    }
    return answers;
  } catch {
    return {};
  }
}

function typeLabel(dict: Dictionary, type: DraftType): string {
  if (type === 'Complaint') return dict.drafts.typeComplaint;
  if (type === 'RTI') return dict.drafts.typeRti;
  return dict.drafts.typeLegalNotice;
}

export function createDraftsService(options: {
  repos: Repositories;
  clock: Clock;
  ai: AiProvider;
}): DraftService {
  const { repos, clock, ai } = options;

  function draftNotFound(locale: Locale): AppError {
    return notFound(getDictionary(locale).drafts.notFound);
  }

  async function requireOwned(
    citizenId: number,
    draftId: number,
    locale: Locale,
  ): Promise<DraftRow> {
    const row = await repos.drafts.findOwned(citizenId, draftId);
    if (!row) throw draftNotFound(locale);
    return row;
  }

  async function citizenName(citizenId: number): Promise<string> {
    const user = await repos.users.findById(citizenId);
    return user?.name ?? '';
  }

  function invalidTransition(locale: Locale): AppError {
    return new AppError('INVALID_TRANSITION', getDictionary(locale).drafts.invalidTransition);
  }

  /** Trim expired claims, so a crashed reviewer never blocks a draft. */
  function liveClaims(raw: Claims): Claims {
    const now = clock.now().getTime();
    const claims: Claims = {};
    for (const [draftId, claim] of Object.entries(raw)) {
      if (new Date(`${claim.expiresAt.replace(' ', 'T')}Z`).getTime() > now) {
        claims[draftId] = claim;
      }
    }
    return claims;
  }

  async function readClaims(): Promise<Claims> {
    return liveClaims(await repos.settings.getJson<Claims>(CLAIM_KEY, {}));
  }

  /**
   * Drop expired review claims (AGENTS.md §12.4). Claims are also pruned on
   * read, so this only keeps the stored JSON from growing.
   */
  async function releaseExpiredClaims(): Promise<number> {
    const raw = await repos.settings.getJson<Claims>(CLAIM_KEY, {});
    const live = liveClaims(raw);
    const removed = Object.keys(raw).length - Object.keys(live).length;
    if (removed > 0) await repos.settings.setJson(CLAIM_KEY, live);
    return removed;
  }

  async function claimFor(lawyerId: number, draftId: number): Promise<Claim | null> {
    const claims = await readClaims();
    const existing = claims[String(draftId)];
    if (existing && existing.lawyerId !== lawyerId) return existing;

    const expiresAt = clock.timestamp(new Date(clock.now().getTime() + CLAIM_TTL_MS));
    claims[String(draftId)] = { lawyerId, expiresAt };
    await repos.settings.setJson(CLAIM_KEY, claims);
    return null;
  }

  async function releaseClaim(draftId: number): Promise<void> {
    const claims = await readClaims();
    delete claims[String(draftId)];
    await repos.settings.setJson(CLAIM_KEY, claims);
  }

  async function notify(
    userId: number,
    language: 'English' | 'Hindi',
    key: 'draftApproved' | 'draftRejected' | 'draftRegenerated' | 'draftQueued',
    variables: Record<string, string | number>,
    at: string,
  ): Promise<void> {
    const locale: Locale = language === 'Hindi' ? 'hi' : 'en';
    const dictionary = getDictionary(locale);
    const message = formatMessage(dictionary.notifications[key], variables).slice(0, 255);
    await repos.notifications.create({
      userId,
      message,
      channel: 'In-App',
      status: 'Unread',
      timestamp: at,
    });
  }

  async function notifyLawyersOfQueue(row: DraftRow, at: string): Promise<void> {
    const marker = `draft:${row.draft_id}:v${row.version}`;
    if (await repos.metrics.findForRef('draft_queued', marker)) return;

    const lawyers = await repos.users.usersByRole('Lawyer');
    const dict = getDictionary('en');
    const type = typeLabel(dict, row.draft_type);
    for (const lawyer of lawyers) {
      await notify(lawyer.userId, lawyer.language, 'draftQueued', { type }, at);
    }

    await repos.metrics.record({
      metric: 'draft_queued',
      value: row.version,
      refId: marker,
      at,
    });
  }

  async function timelineFor(row: DraftRow): Promise<DraftTimelineEntryDto[]> {
    const [reviews, regenerations] = await Promise.all([
      repos.drafts.listReviews(row.draft_id),
      repos.metrics.listByRefPrefix('draft_regenerated', `draft:${row.draft_id}:v`),
    ]);

    const entries: DraftTimelineEntryDto[] = [
      { kind: 'submitted', at: row.created_at, remarks: null, version: 1, actorName: null },
      ...reviews.map((review) => ({
        kind: review.decision === 'Approved' ? ('approved' as const) : ('rejected' as const),
        at: review.reviewed_at,
        remarks: review.remarks,
        version: null,
        actorName: review.lawyer_name,
      })),
      ...regenerations.map((event) => ({
        kind: 'regenerated' as const,
        at: event.created_at,
        remarks: null,
        version: Math.round(event.value),
        actorName: null,
      })),
    ];

    return entries.sort((left, right) => left.at.localeCompare(right.at));
  }

  async function toDetail(row: DraftRow, locale: Locale): Promise<DraftDetailDto> {
    const [reviews, approval, timeline] = await Promise.all([
      repos.drafts.listReviews(row.draft_id),
      repos.drafts.firstApproval(row.draft_id),
      timelineFor(row),
    ]);

    const answers = parseAnswers(row.form_data);
    return {
      id: row.draft_id,
      type: row.draft_type,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      preview: truncate(
        typeof answers.facts === 'string'
          ? answers.facts
          : typeof answers.information === 'string'
            ? answers.information
            : typeof answers.demand === 'string'
              ? answers.demand
              : typeLabel(getDictionary(locale), row.draft_type),
      ),
      rejectionCount: reviews.filter((review) => review.decision === 'Rejected').length,
      answers,
      generatedText: row.status === 'Approved' ? row.generated_text : null,
      timeline,
      approval: approval
        ? { lawyerName: approval.lawyer_name, approvedAt: approval.reviewed_at }
        : null,
      pdfAvailable: row.status === 'Approved',
    };
  }

  function toSummary(row: DraftRow, rejectionCount: number): DraftSummaryDto {
    const answers = parseAnswers(row.form_data);
    const facts =
      typeof answers.facts === 'string'
        ? answers.facts
        : typeof answers.information === 'string'
          ? answers.information
          : typeof answers.demand === 'string'
            ? answers.demand
            : row.draft_type;
    return {
      id: row.draft_id,
      type: row.draft_type,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      preview: truncate(facts),
      rejectionCount,
    };
  }

  async function generateText(
    row: Pick<DraftRow, 'draft_type' | 'form_data'>,
    citizen: string,
    language: 'English' | 'Hindi',
    extras: { remarks?: string; previousText?: string } = {},
  ): Promise<string> {
    const answers = parseAnswers(row.form_data);
    const context = {
      type: row.draft_type,
      language,
      answers,
      citizenName: citizen,
      today: clock.today(),
      ...extras,
    };

    const result = extras.remarks
      ? await ai.regenerateDraft(context)
      : await ai.generateDraft(context);
    const text = result.text.trim();
    if (text.length === 0) {
      throw new AppError('AI_UNAVAILABLE', getDictionary('en').drafts.aiUnavailable);
    }
    return text;
  }

  async function reviewDetail(
    lawyerId: number,
    row: DraftRow,
  ): Promise<ReviewDetailDto> {
    const [citizen, reviews, claim] = await Promise.all([
      citizenName(row.citizen_id),
      repos.drafts.listReviews(row.draft_id),
      claimFor(lawyerId, row.draft_id),
    ]);

    const claimedBy = claim ? (await repos.users.findById(claim.lawyerId))?.name ?? null : null;

    return {
      id: row.draft_id,
      type: row.draft_type,
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      citizenName: citizen,
      answers: parseAnswers(row.form_data),
      generatedText: row.generated_text,
      reviews: reviews.map((review) => ({
        decision: review.decision,
        remarks: review.remarks,
        reviewedAt: review.reviewed_at,
        lawyerName: review.lawyer_name,
      })),
      claimedBy,
      claimedUntil: claim?.expiresAt ?? null,
      claimedByMe: claim === null,
    };
  }

  async function ensureOwnClaim(lawyerId: number, draftId: number, locale: Locale): Promise<void> {
    const claim = await claimFor(lawyerId, draftId);
    if (claim) {
      const holder = await repos.users.findById(claim.lawyerId);
      throw new AppError(
        'CONFLICT',
        formatMessage(getDictionary(locale).drafts.claimedBy, {
          name: holder?.name ?? getDictionary(locale).drafts.anotherLawyer,
        }),
      );
    }
  }

  async function regenerateOwned(
    citizenId: number,
    draftId: number,
    locale: Locale,
  ): Promise<DraftDetailDto> {
    const row = await requireOwned(citizenId, draftId, locale);
    if (row.status !== 'Rejected') throw invalidTransition(locale);

    const latestRejection = (await repos.drafts.listReviews(draftId))
      .filter((review) => review.decision === 'Rejected')
      .at(-1);
    if (!latestRejection?.remarks) throw invalidTransition(locale);

    const user = await repos.users.findById(citizenId);
    const citizen = await citizenName(citizenId);
    const text = await generateText(row, citizen, user?.language ?? 'English', {
      remarks: latestRejection.remarks,
      previousText: row.generated_text,
    });

    const at = clock.nowIso();
    const updated = await repos.drafts.replaceGenerated(draftId, {
      generatedText: text,
      version: row.version + 1,
      status: 'Pending Review',
      expected: 'Rejected',
    });
    if (!updated) throw invalidTransition(locale);

    await repos.metrics.record({
      metric: 'draft_regenerated',
      value: row.version + 1,
      refId: `draft:${draftId}:v${row.version + 1}`,
      at,
    });

    await notify(
      citizenId,
      user?.language ?? 'English',
      'draftRegenerated',
      { version: row.version + 1 },
      at,
    );

    const fresh = await requireOwned(citizenId, draftId, locale);
    await notifyLawyersOfQueue(fresh, at);
    return toDetail(fresh, locale);
  }

  return {
    demoMode: ai.demo,

    async createDraft(citizenId, input, locale) {
      const dictionary = getDictionary(locale);
      const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};

      const validation = validateDraftFormInput(record.draft_type, record.form_data, locale);
      if (!validation.ok) throw validationFailed(validation.errors);

      const user = await repos.users.findById(citizenId);
      if (!user) throw notFound(dictionary.drafts.notFound);

      const citizen = await citizenName(citizenId);
      // The AI call happens before any insert: a failure saves nothing.
      const generatedText = await generateText(
        { draft_type: validation.value.type, form_data: validation.value.serialized },
        citizen,
        user.language,
      );

      if (generatedText.length > 20000) {
        throw new AppError('AI_UNAVAILABLE', dictionary.drafts.aiUnavailable);
      }

      const row = await repos.drafts.create({
        citizenId,
        draftType: validation.value.type,
        formData: validation.value.serialized,
        generatedText,
        status: 'Pending Review',
        version: 1,
        createdAt: clock.nowIso(),
      });

      await notifyLawyersOfQueue(row, row.created_at);
      return toDetail(row, locale);
    },

    async listForCitizen(citizenId) {
      const rows = await repos.drafts.listForCitizen(citizenId);
      const summaries: DraftSummaryDto[] = [];
      for (const row of rows) {
        const reviews = await repos.drafts.listReviews(row.draft_id);
        summaries.push(toSummary(row, reviews.filter((r) => r.decision === 'Rejected').length));
      }
      return summaries;
    },

    async getForCitizen(citizenId, draftId, locale) {
      const row = await requireOwned(citizenId, draftId, locale);
      return toDetail(row, locale);
    },

    async submitForReview(citizenId, draftId, locale) {
      const row = await requireOwned(citizenId, draftId, locale);
      if (row.status !== 'Pending Review') throw invalidTransition(locale);

      // Idempotent: the notification fan-out is recorded once per version.
      await notifyLawyersOfQueue(row, clock.nowIso());
      return toDetail(row, locale);
    },

    async regenerate(citizenId, draftId, locale) {
      return regenerateOwned(citizenId, draftId, locale);
    },

    async exportPDF(citizenId, draftId, locale) {
      // Ownership is checked first so a citizen cannot probe another's draft.
      const row = await requireOwned(citizenId, draftId, locale);
      if (row.status !== 'Approved') {
        throw new AppError('DRAFT_NOT_APPROVED', getDictionary(locale).drafts.notApproved);
      }

      const [approval, citizenUser] = await Promise.all([
        repos.drafts.firstApproval(draftId),
        repos.users.findById(citizenId),
      ]);

      const byteClock = clock.now();
      const approvedAt = approval?.reviewed_at ?? row.created_at;
      const bytes = await renderDraftPdf({
        draftId: row.draft_id,
        version: row.version,
        language: citizenUser?.language ?? 'English',
        title: typeLabel(getDictionary(locale), row.draft_type),
        text: row.generated_text,
        citizenName: citizenUser?.name ?? '',
        lawyerName: approval?.lawyer_name ?? '',
        approvedAt,
        approvedOn: formatPdfDate(approvedAt, locale),
        disclaimer: getDictionary(locale).common.footerDisclaimer,
      });

      return {
        bytes,
        fileName: `lawtrack-draft-${row.draft_id}-v${row.version}-${byteClock.getTime()}.pdf`,
      };
    },

    async queue(lawyerId) {
      const rows = await repos.drafts.queue();
      const claims = await readClaims();

      const items: ReviewQueueItemDto[] = [];
      for (const row of rows) {
        const claim = claims[String(row.draft_id)];
        const holder =
          claim && claim.lawyerId !== lawyerId
            ? (await repos.users.findById(claim.lawyerId))?.name ?? null
            : null;

        const ageMs = Math.max(0, clock.now().getTime() - parseTimestamp(row.created_at));
        const ageHours = Math.round((ageMs / 3_600_000) * 10) / 10;
        items.push({
          id: row.draft_id,
          type: row.draft_type,
          version: row.version,
          citizenName: row.citizen_name,
          createdAt: row.created_at,
          ageHours,
          slaDueAt: clock.timestamp(new Date(parseTimestamp(row.created_at) + SLA_HOURS * 3_600_000)),
          overdue: ageMs > SLA_HOURS * 3_600_000,
          reviewCount: Number(row.review_count ?? 0),
          claimedBy: holder,
        });
      }

      return items;
    },

    async getForReview(lawyerId, draftId, locale) {
      const row = await repos.drafts.findById(draftId);
      if (!row) throw draftNotFound(locale);
      return reviewDetail(lawyerId, row);
    },

    async approve(lawyerId, draftId, locale) {
      const row = await repos.drafts.findById(draftId);
      if (!row) throw draftNotFound(locale);
      if (!canDecide(row.status, 'approve')) throw invalidTransition(locale);
      await ensureOwnClaim(lawyerId, draftId, locale);

      const at = clock.nowIso();
      const moved = await repos.drafts.updateStatus(draftId, 'Approved', 'Pending Review');
      if (!moved) throw invalidTransition(locale);

      await repos.drafts.addReview({
        draftId,
        lawyerId,
        decision: 'Approved',
        remarks: null,
        reviewedAt: at,
      });

      await repos.audit.record({
        performedBy: lawyerId,
        action: 'DRAFT_APPROVED',
        details: { draftId, version: row.version },
        timestamp: at,
      });

      const citizen = await repos.users.findById(row.citizen_id);
      await notify(
        row.citizen_id,
        citizen?.language ?? 'English',
        'draftApproved',
        { type: typeLabel(getDictionary(locale), row.draft_type) },
        at,
      );

      await releaseClaim(draftId);
      const fresh = await repos.drafts.findById(draftId);
      return toDetail(fresh ?? row, locale);
    },

    async reject(lawyerId, draftId, input, locale) {
      const row = await repos.drafts.findById(draftId);
      if (!row) throw draftNotFound(locale);
      if (!canDecide(row.status, 'reject')) throw invalidTransition(locale);

      const validation = validateReviewRemarks(input, locale);
      if (!validation.ok) throw validationFailed(validation.errors);

      await ensureOwnClaim(lawyerId, draftId, locale);

      const at = clock.nowIso();
      const moved = await repos.drafts.updateStatus(draftId, 'Rejected', 'Pending Review');
      if (!moved) throw invalidTransition(locale);

      await repos.drafts.addReview({
        draftId,
        lawyerId,
        decision: 'Rejected',
        remarks: validation.value.remarks,
        reviewedAt: at,
      });

      await repos.audit.record({
        performedBy: lawyerId,
        action: 'DRAFT_REJECTED',
        details: { draftId, version: row.version },
        timestamp: at,
      });

      const citizen = await repos.users.findById(row.citizen_id);
      await notify(
        row.citizen_id,
        citizen?.language ?? 'English',
        'draftRejected',
        { type: typeLabel(getDictionary(locale), row.draft_type) },
        at,
      );

      await releaseClaim(draftId);
      const rejectedRow = await repos.drafts.findById(draftId);
      if (!rejectedRow) throw draftNotFound(locale);

      // Regenerate immediately; if the AI is unavailable the draft stays
      // Rejected and the citizen can retry from the draft page.
      try {
        const regenerated = await regenerateOwned(row.citizen_id, draftId, locale);
        return { draft: regenerated, regenerationFailed: false };
      } catch (error) {
        if (error instanceof AppError && error.code === 'AI_UNAVAILABLE') {
          return { draft: await toDetail(rejectedRow, locale), regenerationFailed: true };
        }
        throw error;
      }
    },

    async setLawyerStatus(lawyerId, input, locale) {
      const record =
        typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
      const raw = typeof record.status === 'string' ? record.status.trim() : '';
      const dictionary = getDictionary(locale);

      if (raw.length === 0) {
        throw validationFailed([
          {
            field: 'status',
            code: 'REQUIRED',
            message: dictionary.validation.required.replace('{{field}}', dictionary.drafts.availability),
          },
        ]);
      }
      if (!(LAWYER_STATUSES as readonly string[]).includes(raw)) {
        throw validationFailed([
          {
            field: 'status',
            code: 'ENUM',
            message: dictionary.validation.invalidEnum
              .replace('{{field}}', dictionary.drafts.availability)
              .replace('{{allowed}}', LAWYER_STATUSES.join(', ')),
          },
        ]);
      }

      const status = raw as LawyerStatus;
      await repos.users.setLawyerStatus(lawyerId, status);
      await repos.audit.record({
        performedBy: lawyerId,
        action: 'LAWYER_AVAILABILITY_CHANGED',
        details: { status },
        timestamp: clock.nowIso(),
      });
      return { status };
    },

    releaseExpiredClaims,
  };
}

function parseTimestamp(value: string): number {
  return new Date(`${value.trim().replace(' ', 'T')}Z`).getTime();
}

function formatPdfDate(value: string, locale: Locale): string {
  const date = new Date(`${value.trim().replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}
