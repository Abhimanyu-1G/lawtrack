import 'server-only';

import { AppError } from '../../lib/errors';
import type { ECourtsCase, ECourtsClient } from './types';

/**
 * Placeholder for the real eCourts integration (AGENTS.md §11).
 *
 * The prototype never calls a government service. When this is implemented the
 * contract is:
 *
 *   GET /ecourts/v1/case/{cnrId}
 *     headers: Authorization: Bearer <ECOURTS_API_TOKEN>
 *     success: 200 { cnrId, caseStatus, caseTitle, courtName,
 *                    nextHearingDate: 'YYYY-MM-DD' | null,
 *                    hearings: [{ hearingDate, purpose, orderText, orderPdfUrl }] }
 *     404:     { error: { code: 'CASE_NOT_FOUND' } }
 *     timeout: 5 s, then two retries with exponential backoff
 *
 * Until `ECOURTS_BASE_URL` and `ECOURTS_API_TOKEN` exist in the environment this
 * client refuses every call with `503 NOT_CONFIGURED`, which the case service
 * maps to the same "try again later" path as an outage.
 */
export const ECOURTS_CONTRACT = {
  path: '/ecourts/v1/case/{cnrId}',
  auth: 'Bearer <ECOURTS_API_TOKEN>',
  timeoutMs: 5_000,
  retries: 2,
} as const;

export function createRealECourtsClient(): ECourtsClient {
  return {
    name: 'real',
    async getCaseByCnr(): Promise<ECourtsCase> {
      throw new AppError(
        'NOT_CONFIGURED',
        'The live eCourts integration is not configured in this prototype',
      );
    },
  };
}
