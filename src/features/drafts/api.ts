import type { Locale } from '../../i18n';
import { ApiRequestError, apiRequest } from '../auth/api';
import type { DraftDetail, DraftSummary, HelpRequest, ReviewDetail, ReviewQueueItem } from './types';

/** Typed calls to the Phase 5 draft endpoints. */

interface DraftsResponse {
  drafts: DraftSummary[];
  demo?: boolean;
}

interface DraftResponse {
  draft: DraftDetail;
  demo?: boolean;
}

interface QueueResponse {
  queue: ReviewQueueItem[];
}

interface ReviewResponse {
  draft: ReviewDetail;
}

interface RejectResponse {
  draft: DraftDetail;
  regenerationFailed: boolean;
}

interface HelpResponse {
  requests: HelpRequest[];
}

export async function listDrafts(locale: Locale): Promise<DraftSummary[]> {
  const data = await apiRequest<DraftsResponse>('/api/drafts', { method: 'GET', locale });
  return data.drafts;
}

export async function getDraft(id: number, locale: Locale): Promise<DraftDetail> {
  const data = await apiRequest<DraftResponse>(`/api/drafts/${id}`, { method: 'GET', locale });
  return data.draft;
}

export async function createDraft(
  payload: { draft_type: string; form_data: Record<string, unknown> },
  locale: Locale,
): Promise<DraftDetail> {
  const data = await apiRequest<DraftResponse>('/api/drafts', {
    method: 'POST',
    body: payload,
    locale,
  });
  return data.draft;
}

export async function regenerateDraft(id: number, locale: Locale): Promise<DraftDetail> {
  const data = await apiRequest<DraftResponse>(`/api/drafts/${id}/regenerate`, {
    method: 'POST',
    locale,
  });
  return data.draft;
}

/**
 * Fetch the approved PDF as a Blob. The API is same-origin and cookie-auth, so
 * a plain `fetch` keeps the session; CSRF is unnecessary for a read.
 */
export async function downloadDraftPdf(id: number): Promise<Blob> {
  const response = await fetch(`/api/drafts/${id}/pdf`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiRequestError('PDF_FAILED', 'The PDF could not be prepared', response.status);
  }
  return response.blob();
}

export async function getQueue(locale: Locale): Promise<ReviewQueueItem[]> {
  const data = await apiRequest<QueueResponse>('/api/lawyer/queue', { method: 'GET', locale });
  return data.queue;
}

export async function getReview(id: number, locale: Locale): Promise<ReviewDetail> {
  const data = await apiRequest<ReviewResponse>(`/api/lawyer/drafts/${id}`, {
    method: 'GET',
    locale,
  });
  return data.draft;
}

export async function approveDraft(id: number, locale: Locale): Promise<DraftDetail> {
  const data = await apiRequest<DraftResponse>(`/api/lawyer/drafts/${id}/approve`, {
    method: 'POST',
    locale,
  });
  return data.draft;
}

export async function rejectDraft(
  id: number,
  remarks: string,
  locale: Locale,
): Promise<RejectResponse> {
  return apiRequest<RejectResponse>(`/api/lawyer/drafts/${id}/reject`, {
    method: 'POST',
    body: { remarks },
    locale,
  });
}

export async function setLawyerStatus(
  status: 'Available' | 'Busy' | 'Offline',
  locale: Locale,
): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/api/lawyer/status', {
    method: 'PATCH',
    body: { status },
    locale,
  });
}

export async function listHelpRequests(locale: Locale): Promise<HelpRequest[]> {
  const data = await apiRequest<HelpResponse>('/api/lawyer/help-requests', {
    method: 'GET',
    locale,
  });
  return data.requests;
}
