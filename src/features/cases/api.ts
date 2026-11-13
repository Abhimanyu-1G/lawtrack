import type { Locale } from '../../i18n';
import { apiRequest } from '../auth/api';
import type { CaseLookupResult, CaseView, HearingView } from './types';

/** Typed calls to the Phase 6 case endpoints. */

export async function lookupCase(cnr: string, locale: Locale): Promise<CaseLookupResult> {
  return apiRequest<CaseLookupResult>('/api/cases/lookup', {
    method: 'POST',
    body: { cnr },
    locale,
  });
}

export async function listCases(locale: Locale): Promise<CaseView[]> {
  const data = await apiRequest<{ cases: CaseView[] }>('/api/cases', { method: 'GET', locale });
  return data.cases;
}

export async function getCase(id: number, locale: Locale): Promise<CaseView> {
  const data = await apiRequest<{ case: CaseView }>(`/api/cases/${id}`, { method: 'GET', locale });
  return data.case;
}

export async function getHearings(id: number, locale: Locale): Promise<HearingView[]> {
  const data = await apiRequest<{ hearings: HearingView[] }>(`/api/cases/${id}/hearings`, {
    method: 'GET',
    locale,
  });
  return data.hearings;
}

export async function setTracking(
  id: number,
  subscribed: boolean,
  locale: Locale,
): Promise<{ subscribed: boolean }> {
  return apiRequest<{ subscribed: boolean }>(`/api/cases/${id}/subscribe`, {
    method: subscribed ? 'POST' : 'DELETE',
    locale,
  });
}

export async function refreshCase(id: number, locale: Locale): Promise<CaseView> {
  const data = await apiRequest<{ case: CaseView }>(`/api/cases/${id}/refresh`, {
    method: 'POST',
    locale,
  });
  return data.case;
}
