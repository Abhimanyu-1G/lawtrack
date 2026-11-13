import type { Dictionary, Locale } from '../../i18n';
import type { DraftStatus, DraftType } from '../../shared/enums';

/** Display helpers shared by the citizen and lawyer draft screens. */

export function formatDraftDate(value: string, locale: Locale): string {
  const date = new Date(`${value.trim().replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export function formatDraftDateTime(value: string, locale: Locale): string {
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

export function draftStatusLabel(dict: Dictionary, status: DraftStatus): string {
  if (status === 'Approved') return dict.drafts.statusApproved;
  if (status === 'Rejected') return dict.drafts.statusRejected;
  if (status === 'Regenerating') return dict.drafts.statusRegenerating;
  return dict.drafts.statusPending;
}

export function draftTypeName(dict: Dictionary, type: DraftType): string {
  if (type === 'Complaint') return dict.drafts.typeComplaint;
  if (type === 'RTI') return dict.drafts.typeRti;
  return dict.drafts.typeLegalNotice;
}

/** Render an answer for the review step; checkbox/select use dictionary labels. */
export function answerDisplay(
  dict: Dictionary,
  name: string,
  value: string | number | boolean,
): string {
  if (typeof value === 'boolean') return value ? dict.drafts.yes : dict.drafts.no;
  const key = `${name}_${String(value)}`;
  const labels = dict.drafts.fields as Record<string, string>;
  if (typeof value === 'string') {
    if (value === 'State' || value === 'Central') {
      return (value === 'State' ? labels.levelState : labels.levelCentral) ?? value;
    }
    if (value === 'Post' || value === 'Email' || value === 'In person') {
      if (value === 'Post') return labels.replyPost ?? value;
      if (value === 'Email') return labels.replyEmail ?? value;
      return labels.replyInPerson ?? value;
    }
  }
  return labels[key] ?? String(value);
}
