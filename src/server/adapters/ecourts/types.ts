import 'server-only';

import type { CaseStatus } from '../../../shared/enums';

/**
 * eCourts adapter contract (AGENTS.md §11).
 *
 * The real service is a government API the prototype never calls. Everything
 * that needs case data depends on this interface so the deterministic mock and
 * a future real client are interchangeable.
 */

export interface ECourtsHearing {
  /** Asia/Kolkata calendar date `YYYY-MM-DD`. */
  date: string;
  purpose: string;
  /** Raw order text from the court; simplified before it is stored. */
  orderText?: string | null;
  /** Local sample PDF in this prototype. */
  orderUrl?: string | null;
}

export interface ECourtsCase {
  cnr: string;
  status: CaseStatus;
  caseTitle: string;
  courtName: string;
  /** `null` when the court has not listed the next date yet. */
  nextHearingDate: string | null;
  hearings: ECourtsHearing[];
}

export interface ECourtsClient {
  readonly name: string;
  getCaseByCnr(cnr: string): Promise<ECourtsCase>;
}

/** The CNR is well formed but no court record exists for it. */
export class ECourtsNotFoundError extends Error {
  constructor(cnr: string) {
    super(`No eCourts record was found for ${cnr}`);
    this.name = 'ECourtsNotFoundError';
  }
}

/** The upstream service did not answer in time. */
export class ECourtsTimeoutError extends Error {
  constructor(message = 'eCourts did not respond in time') {
    super(message);
    this.name = 'ECourtsTimeoutError';
  }
}

/** The upstream service answered with an unusable payload. */
export class ECourtsUnavailableError extends Error {
  constructor(message = 'eCourts is temporarily unavailable') {
    super(message);
    this.name = 'ECourtsUnavailableError';
  }
}
