import type { Dictionary, Locale } from '../../i18n';
import { formatMessage } from '../../i18n';
import { toKolkataDate } from '../../shared/clock';
import type { CaseView } from './types';

/** Display helpers for the case tracker. */

export function formatCaseDate(value: string, locale: Locale): string {
  const date = new Date(`${value.trim().slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export function formatCaseSyncedAt(value: string, locale: Locale): string {
  const date = new Date(`${value.trim().replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);

  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/** Whole days from today (Asia/Kolkata) to the hearing date. */
export function daysUntil(date: string): number {
  const today = toKolkataDate(new Date());
  const from = Date.parse(`${today}T00:00:00Z`);
  const to = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/**
 * "Hearing today" / "tomorrow" / "in N days", or the overdue notice when the
 * court has not listed a new date. `null` when there is no next date at all.
 */
export function nextHearingLabel(dict: Dictionary, nextHearingDate: string | null): string | null {
  if (!nextHearingDate) return null;
  const days = daysUntil(nextHearingDate);
  if (days < 0) return dict.cases.overdueNotice;
  if (days === 0) return dict.cases.nextHearingToday;
  if (days === 1) return dict.cases.nextHearingTomorrow;
  return formatMessage(dict.cases.nextHearingIn, { days });
}

export function caseStatusLabel(dict: Dictionary, status: CaseView['status']): string {
  return status === 'Disposed' ? dict.cases.statusDisposed : dict.cases.statusPending;
}

export function caseStatusTone(status: CaseView['status']): 'success' | 'warning' {
  return status === 'Disposed' ? 'success' : 'warning';
}

/** Uppercase, alphanumeric-only CNR typed by the user (max 16). */
export function normaliseCnrInput(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
}
