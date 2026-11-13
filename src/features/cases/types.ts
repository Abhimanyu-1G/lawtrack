import type { CaseStatus } from '../../shared/enums';

/** Client-side shapes for the case tracker (Phase 6). */

export interface HearingView {
  id: number;
  date: string;
  purpose: string;
  orderSummary: string | null;
  orderUrl: string | null;
}

export interface CaseView {
  id: number;
  cnr: string;
  title: string;
  courtName: string;
  status: CaseStatus;
  nextHearingDate: string | null;
  lastSyncedAt: string;
  stale: boolean;
  subscribed: boolean;
  hearings: HearingView[];
}

export interface CaseLookupResult {
  case: CaseView;
  cached: boolean;
  stale: boolean;
}
