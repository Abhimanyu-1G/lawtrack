import type { DraftStatus, DraftType } from '../../shared/enums';
import type { DraftAnswers } from '../../shared/validation';

/** Client-side shapes returned by the draft API (Phase 5). */

export interface DraftTimelineEntry {
  kind: 'submitted' | 'approved' | 'rejected' | 'regenerated';
  at: string;
  remarks: string | null;
  version: number | null;
  actorName: string | null;
}

export interface DraftSummary {
  id: number;
  type: DraftType;
  status: DraftStatus;
  version: number;
  createdAt: string;
  preview: string;
  rejectionCount: number;
}

export interface DraftDetail extends DraftSummary {
  answers: DraftAnswers;
  generatedText: string | null;
  timeline: DraftTimelineEntry[];
  approval: { lawyerName: string; approvedAt: string } | null;
  pdfAvailable: boolean;
}

export interface ReviewQueueItem {
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

export interface ReviewDetail {
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

export interface HelpRequest {
  sessionId: number;
  citizenName: string;
  preview: string;
  requestedAt: string;
}

export function draftTypeLabel(
  type: DraftType,
  labels: { typeComplaint: string; typeRti: string; typeLegalNotice: string },
): string {
  if (type === 'Complaint') return labels.typeComplaint;
  if (type === 'RTI') return labels.typeRti;
  return labels.typeLegalNotice;
}

export function statusTone(status: DraftStatus): 'success' | 'warning' | 'danger' | 'primary' {
  if (status === 'Approved') return 'success';
  if (status === 'Rejected') return 'danger';
  if (status === 'Regenerating') return 'primary';
  return 'warning';
}
