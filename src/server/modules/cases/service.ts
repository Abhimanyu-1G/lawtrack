import 'server-only';

import {
  formatMessage,
  getDictionary,
  type Dictionary,
  type Locale,
} from '../../../i18n';
import type { CaseStatus, Language } from '../../../shared/enums';
import {
  validateCnrLookup,
  type CnrLookupInput,
} from '../../../shared/validation';
import type { ValidationResult } from '../../../shared/errors';
import type { AiProvider } from '../../adapters/ai/provider';
import {
  ECourtsNotFoundError,
  ECourtsTimeoutError,
  type ECourtsCase,
  type ECourtsClient,
} from '../../adapters/ecourts/types';
import type { Repositories } from '../../db/repositories';
import { addMinutes, type Clock } from '../../lib/clock';
import { AppError, notFound, validationFailed } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { CourtCaseRow } from './repo';

/**
 * Court case tracking (AGENTS.md §6 Court_Case, §11, §13).
 *
 *   validateCNR ──► cache hit (<15 min) ──► stored row
 *                        │
 *                        └─► eCourts ──► upsert + hearings + notifications
 *
 * A malformed CNR is rejected before any adapter call. Adapter failures are
 * reflected in `API_Integration` (Degraded at ≥1, Down at ≥3) and a previously
 * cached case is still returned with `stale: true` so the UI can show a banner
 * instead of an error.
 */

export const ECOURTS_INTEGRATION_ID = 1;
const DEFAULT_CACHE_MINUTES = 15;
const ADAPTER_TIMEOUT_MS = 5_000;
const ORDER_SUMMARY_MAX = 600;
const REMINDER_WINDOW_DAYS = 2;

export interface HearingDto {
  id: number;
  date: string;
  purpose: string;
  orderSummary: string | null;
  orderUrl: string | null;
}

export interface CaseDetailDto {
  id: number;
  cnr: string;
  title: string;
  courtName: string;
  status: CaseStatus;
  nextHearingDate: string | null;
  lastSyncedAt: string;
  /** True when the adapter failed and this is the last stored copy. */
  stale: boolean;
  subscribed: boolean;
  hearings: HearingDto[];
}

export interface CaseLookupDto {
  case: CaseDetailDto;
  /** Served from the 15-minute cache; the adapter was not called. */
  cached: boolean;
  stale: boolean;
}

export type SyncSummaryDto = {
  attempted: number;
  succeeded: number;
  failed: number;
};

export interface CasesService {
  validateCNR(input: unknown, locale: Locale): ValidationResult<CnrLookupInput>;
  fetchByCNR(citizenId: number, input: unknown, locale: Locale): Promise<CaseLookupDto>;
  listForCitizen(citizenId: number): Promise<CaseDetailDto[]>;
  getForCitizen(citizenId: number, caseId: number, locale: Locale): Promise<CaseDetailDto>;
  subscribe(citizenId: number, caseId: number): Promise<{ subscribed: boolean }>;
  unsubscribe(citizenId: number, caseId: number): Promise<{ subscribed: boolean }>;
  hearings(citizenId: number, caseId: number): Promise<HearingDto[]>;
  /** On-demand re-sync for a citizen who tracks the case (D-52). */
  refreshForCitizen(citizenId: number, caseId: number, locale: Locale): Promise<CaseDetailDto>;
  refreshFromAPI(caseId: number, locale: Locale): Promise<CaseDetailDto>;
  refreshTrackedCases(): Promise<SyncSummaryDto>;
  sendHearingReminders(): Promise<{ sent: number }>;
}

interface CasesServiceOptions {
  repos: Repositories;
  clock: Clock;
  ai: AiProvider;
  ecourts: ECourtsClient;
  /** Override the 15-minute lookup cache (tests use 0). */
  cacheMinutes?: number;
}

/** Localise the integration status so a Hindi user sees Hindi text. */
function statusLabel(dict: Dictionary, status: CaseStatus): string {
  return status === 'Disposed' ? dict.cases.statusDisposed : dict.cases.statusPending;
}

function languageOf(locale: Locale): Language {
  return locale === 'hi' ? 'Hindi' : 'English';
}

/** `YYYY-MM-DD` plus whole days, using UTC arithmetic on a calendar date. */
function addDaysToDate(date: string, days: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function withTimeout<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ECourtsTimeoutError());
    }, milliseconds);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createCasesService(options: CasesServiceOptions): CasesService {
  const { repos, clock, ai, ecourts } = options;
  const cacheMinutes = options.cacheMinutes ?? DEFAULT_CACHE_MINUTES;

  function integrationFailure(error: unknown): boolean {
    // A well-formed CNR with no court record is not a service health problem.
    return !(error instanceof ECourtsNotFoundError) && !(error instanceof AppError && error.status < 500);
  }

  function isFresh(row: CourtCaseRow): boolean {
    if (cacheMinutes <= 0) return false;
    const syncedAt = new Date(`${row.last_synced_at.replace(' ', 'T')}Z`);
    if (Number.isNaN(syncedAt.getTime())) return false;
    const cutoff = addMinutes(clock.now(), -cacheMinutes);
    return syncedAt.getTime() >= cutoff.getTime();
  }

  /** Simplify court order text with the AI provider; failure keeps the original. */
  async function summarise(orderText: string | null | undefined, locale: Locale): Promise<string | null> {
    const text = (orderText ?? '').replace(/\s+/g, ' ').trim();
    if (text === '') return null;

    try {
      const simplified = await ai.simplifyText(text, languageOf(locale));
      const value = simplified.text.replace(/\s+/g, ' ').trim();
      return (value === '' ? text : value).slice(0, ORDER_SUMMARY_MAX);
    } catch (error) {
      logger.warn({ err: error }, 'Order simplification failed; storing the raw text');
      return text.slice(0, ORDER_SUMMARY_MAX);
    }
  }

  async function persist(remote: ECourtsCase, locale: Locale): Promise<CourtCaseRow> {
    const syncedAt = clock.nowIso();
    const row = await repos.cases.upsert({
      integrationId: ECOURTS_INTEGRATION_ID,
      cnr: remote.cnr,
      title: remote.caseTitle,
      courtName: remote.courtName,
      status: remote.status,
      nextHearingDate: remote.nextHearingDate,
      lastSyncedAt: syncedAt,
    });

    const hearings = [];
    for (const hearing of remote.hearings) {
      hearings.push({
        date: hearing.date,
        purpose: hearing.purpose,
        orderSummary: await summarise(hearing.orderText, locale),
        orderUrl: hearing.orderUrl ?? null,
      });
    }
    await repos.cases.replaceHearings(row.case_id, hearings);

    return row;
  }

  async function notifySubscribers(
    row: CourtCaseRow,
    change: { statusChanged: boolean; hearingChanged: boolean },
    at: string,
  ): Promise<void> {
    if (!change.statusChanged && !change.hearingChanged) return;

    const subscriberIds = await repos.cases.listSubscriberIds(row.case_id);
    if (subscriberIds.length === 0) return;

    for (const userId of subscriberIds) {
      const user = await repos.users.findById(userId);
      if (!user) continue;
      const locale: Locale = user.language === 'Hindi' ? 'hi' : 'en';
      const dictionary = getDictionary(locale);

      if (change.statusChanged) {
        const message = formatMessage(dictionary.notifications.caseStatusChanged, {
          case: row.case_title,
          status: statusLabel(dictionary, row.status),
        }).slice(0, 255);
        await repos.notifications.create({
          userId,
          caseId: row.case_id,
          message,
          channel: 'In-App',
          status: 'Unread',
          timestamp: at,
        });
      }

      if (change.hearingChanged && row.next_hearing_date) {
        const message = formatMessage(dictionary.notifications.caseHearingChanged, {
          case: row.case_title,
          date: row.next_hearing_date,
        }).slice(0, 255);
        await repos.notifications.create({
          userId,
          caseId: row.case_id,
          message,
          channel: 'In-App',
          status: 'Unread',
          timestamp: at,
        });
      }
    }
  }

  /** Call the adapter and apply the result, accounting for integration health. */
  async function sync(row: CourtCaseRow | undefined, cnr: string, locale: Locale) {
    const startedAt = Date.now();
    try {
      const remote = await withTimeout(ecourts.getCaseByCnr(cnr), ADAPTER_TIMEOUT_MS);
      const at = clock.nowIso();

      await repos.integrations.recordSuccess(ECOURTS_INTEGRATION_ID, at);
      const stored = await persist(remote, locale);

      await repos.metrics.record({
        metric: 'case_sync',
        value: 1,
        refId: `case:${stored.case_id}`,
        at,
      });
      await repos.metrics.record({
        metric: 'case_lookup_ms',
        value: Date.now() - startedAt,
        refId: `case:${stored.case_id}`,
        at,
      });

      await notifySubscribers(
        stored,
        {
          statusChanged: row !== undefined && row.status !== stored.status,
          hearingChanged:
            row !== undefined && row.next_hearing_date !== stored.next_hearing_date,
        },
        at,
      );

      return { row: stored, stale: false };
    } catch (error) {
      const at = clock.nowIso();

      if (integrationFailure(error)) {
        const health = await repos.integrations.recordFailure(ECOURTS_INTEGRATION_ID);
        await repos.metrics.record({
          metric: 'case_sync',
          value: 0,
          refId: `cnr:${cnr}`,
          at,
        });
        logger.warn(
          { err: error, cnr, integrationStatus: health.status, errorCount: health.errorCount },
          'eCourts lookup failed',
        );
      }

      throw error;
    }
  }

  async function dto(
    row: CourtCaseRow,
    citizenId: number | null,
    stale: boolean,
  ): Promise<CaseDetailDto> {
    const hearings = await repos.cases.listHearings(row.case_id);
    return {
      id: row.case_id,
      cnr: row.cnr_number,
      title: row.case_title,
      courtName: row.court_name,
      status: row.status,
      nextHearingDate: row.next_hearing_date,
      lastSyncedAt: row.last_synced_at,
      stale,
      subscribed: citizenId === null ? false : await repos.cases.isTracking(citizenId, row.case_id),
      hearings: hearings.map((hearing) => ({
        id: hearing.hearing_id,
        date: hearing.hearing_date,
        purpose: hearing.purpose,
        orderSummary: hearing.order_summary,
        orderUrl: hearing.order_url,
      })),
    };
  }

  function lookupError(error: unknown, locale: Locale): AppError {
    const dictionary = getDictionary(locale);
    if (error instanceof ECourtsNotFoundError) {
      return new AppError('NOT_FOUND', dictionary.cases.notFoundBody);
    }
    return new AppError('UPSTREAM_UNAVAILABLE', dictionary.cases.unavailableBody);
  }

  return {
    validateCNR(input, locale) {
      return validateCnrLookup(input, locale);
    },

    async fetchByCNR(citizenId, input, locale) {
      const validation = validateCnrLookup(input, locale);
      if (!validation.ok) throw validationFailed(validation.errors);
      const cnr = validation.value.cnr;

      const existing = await repos.cases.findByCnr(cnr);
      const at = clock.nowIso();

      if (existing && isFresh(existing)) {
        await repos.cases.track(citizenId, existing.case_id, at);
        return { case: await dto(existing, citizenId, false), cached: true, stale: false };
      }

      try {
        const synced = await sync(existing, cnr, locale);
        await repos.cases.track(citizenId, synced.row.case_id, at);
        return {
          case: await dto(synced.row, citizenId, false),
          cached: false,
          stale: synced.stale,
        };
      } catch (error) {
        if (existing) {
          await repos.cases.track(citizenId, existing.case_id, at);
          return { case: await dto(existing, citizenId, true), cached: true, stale: true };
        }
        throw lookupError(error, locale);
      }
    },

    async listForCitizen(citizenId) {
      const rows = await repos.cases.listTracked(citizenId);
      const results: CaseDetailDto[] = [];
      for (const row of rows) results.push(await dto(row, citizenId, !isFresh(row)));
      return results;
    },

    async getForCitizen(citizenId, caseId, locale) {
      const row = await repos.cases.findById(caseId);
      if (!row) throw notFound(getDictionary(locale).cases.notFoundBody);
      if (!(await repos.cases.isTracking(citizenId, caseId))) {
        throw notFound(getDictionary(locale).cases.notFoundBody);
      }
      return dto(row, citizenId, !isFresh(row));
    },

    async subscribe(citizenId, caseId) {
      const row = await repos.cases.findById(caseId);
      if (!row) throw notFound('Case not found');
      await repos.cases.track(citizenId, caseId, clock.nowIso());
      return { subscribed: true };
    },

    async unsubscribe(citizenId, caseId) {
      await repos.cases.untrack(citizenId, caseId);
      return { subscribed: false };
    },

    async hearings(citizenId, caseId) {
      if (!(await repos.cases.isTracking(citizenId, caseId))) throw notFound('Case not found');
      const rows = await repos.cases.listHearings(caseId);
      return rows.map((hearing) => ({
        id: hearing.hearing_id,
        date: hearing.hearing_date,
        purpose: hearing.purpose,
        orderSummary: hearing.order_summary,
        orderUrl: hearing.order_url,
      }));
    },

    async refreshFromAPI(caseId, locale) {
      const row = await repos.cases.findById(caseId);
      if (!row) throw notFound(getDictionary(locale).cases.notFoundBody);

      try {
        const synced = await sync(row, row.cnr_number, locale);
        return dto(synced.row, null, false);
      } catch {
        return dto(row, null, true);
      }
    },

    async refreshForCitizen(citizenId, caseId, locale) {
      const row = await repos.cases.findById(caseId);
      if (!row || !(await repos.cases.isTracking(citizenId, caseId))) {
        throw notFound(getDictionary(locale).cases.notFoundBody);
      }

      try {
        const synced = await sync(row, row.cnr_number, locale);
        return dto(synced.row, citizenId, false);
      } catch {
        return dto(row, citizenId, true);
      }
    },

    async refreshTrackedCases() {
      const caseIds = await repos.cases.listTrackedCaseIds();
      const summary: SyncSummaryDto = { attempted: caseIds.length, succeeded: 0, failed: 0 };

      const queue = [...caseIds];
      const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
        for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
          const row = await repos.cases.findById(next);
          if (!row) continue;
          try {
            await sync(row, row.cnr_number, 'en');
            summary.succeeded += 1;
          } catch {
            summary.failed += 1;
          }
        }
      });
      await Promise.all(workers);

      return summary;
    },

    async sendHearingReminders() {
      const today = clock.today();
      const until = addDaysToDate(today, REMINDER_WINDOW_DAYS);
      const caseIds = await repos.cases.listTrackedCaseIds();
      let sent = 0;

      for (const caseId of caseIds) {
        const row = await repos.cases.findById(caseId);
        if (!row || !row.next_hearing_date) continue;
        if (row.status === 'Disposed') continue;
        if (row.next_hearing_date < today || row.next_hearing_date > until) continue;

        const subscriberIds = await repos.cases.listSubscriberIds(caseId);
        for (const userId of subscriberIds) {
          const marker = `case:${caseId}:date:${row.next_hearing_date}:user:${userId}`;
          if (await repos.metrics.findForRef('hearing_reminder', marker)) continue;

          const user = await repos.users.findById(userId);
          if (!user) continue;
          const locale: Locale = user.language === 'Hindi' ? 'hi' : 'en';
          const dictionary = getDictionary(locale);
          const message = formatMessage(dictionary.notifications.hearingReminder, {
            case: row.case_title,
            date: row.next_hearing_date,
          }).slice(0, 255);
          const at = clock.nowIso();

          await repos.notifications.create({
            userId,
            caseId,
            message,
            channel: 'In-App',
            status: 'Unread',
            timestamp: at,
          });
          await repos.notifications.create({
            userId,
            caseId,
            message,
            channel: 'Email',
            status: 'Sent',
            timestamp: at,
          });
          await repos.notifications.create({
            userId,
            caseId,
            message,
            channel: 'SMS',
            status: 'Sent',
            timestamp: at,
          });

          await repos.metrics.record({
            metric: 'hearing_reminder',
            value: 1,
            refId: marker,
            at,
          });
          sent += 1;
        }
      }

      return { sent };
    },
  };
}

/** Exported for the jobs layer: the reminder window in days. */
export const HEARING_REMINDER_WINDOW_DAYS = REMINDER_WINDOW_DAYS;
