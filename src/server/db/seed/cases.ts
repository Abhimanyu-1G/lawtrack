import 'server-only';

import type { CaseStatus } from '../../../shared/enums';
import type { Repositories } from '../repositories';

/**
 * Seeded court cases (AGENTS.md §4).
 *
 * These are the same fictional records the eCourts mock serves, so a lookup of
 * a seeded CNR refreshes the row instead of creating a second one. One case is
 * already tracked by the demo citizen so the dashboard is not empty on a fresh
 * install. Idempotent: existing rows are never duplicated.
 */

interface SeedHearing {
  date: string;
  purpose: string;
  orderSummary: string;
  orderUrl: string;
}

interface SeedCase {
  cnr: string;
  title: string;
  courtName: string;
  status: CaseStatus;
  nextHearingDate: string | null;
  trackedByDemoCitizen: boolean;
  hearings: SeedHearing[];
}

const ORDER_URL = '/sample-orders/sample-order.pdf';

const CASES: SeedCase[] = [
  {
    cnr: 'RJJP050033442024',
    title: 'Imran Khan vs National Insurance Co. Ltd.',
    courtName: 'Motor Accident Claims Tribunal, Jaipur',
    status: 'Pending',
    nextHearingDate: '2026-11-15',
    trackedByDemoCitizen: true,
    hearings: [
      {
        date: '2026-07-08',
        purpose: 'Notice to insurer',
        orderSummary:
          'The court sent notice to the insurance company. You must file the disability certificate before the next date.',
        orderUrl: ORDER_URL,
      },
    ],
  },
  {
    cnr: 'RJJP040011222020',
    title: 'Sunita Agarwal vs Rajasthan Housing Board',
    courtName: 'District Court, Jaipur Metropolitan',
    status: 'Disposed',
    nextHearingDate: null,
    trackedByDemoCitizen: false,
    hearings: [
      {
        date: '2026-03-20',
        purpose: 'Evidence',
        orderSummary: 'You must produce the original allotment letter on the next date.',
        orderUrl: ORDER_URL,
      },
      {
        date: '2026-06-26',
        purpose: 'Judgment',
        orderSummary:
          'The court decided the case in favour of the allottee with costs. The case is now closed.',
        orderUrl: ORDER_URL,
      },
    ],
  },
];

export interface SeedCasesResult {
  created: number;
  skipped: number;
  trackingCreated: number;
}

export async function seedCases(
  repos: Repositories,
  options: { at: string; demoCitizenId: number | null },
): Promise<SeedCasesResult> {
  const result: SeedCasesResult = { created: 0, skipped: 0, trackingCreated: 0 };

  for (const seed of CASES) {
    const existing = await repos.cases.findByCnr(seed.cnr);
    let caseId: number;

    if (existing) {
      result.skipped += 1;
      caseId = existing.case_id;
    } else {
      const row = await repos.cases.upsert({
        integrationId: 1,
        cnr: seed.cnr,
        title: seed.title,
        courtName: seed.courtName,
        status: seed.status,
        nextHearingDate: seed.nextHearingDate,
        lastSyncedAt: options.at,
      });
      await repos.cases.replaceHearings(row.case_id, seed.hearings);
      result.created += 1;
      caseId = row.case_id;
    }

    if (seed.trackedByDemoCitizen && options.demoCitizenId !== null) {
      if (!(await repos.cases.isTracking(options.demoCitizenId, caseId))) {
        await repos.cases.track(options.demoCitizenId, caseId, options.at);
        result.trackingCreated += 1;
      }
    }  }

  return result;
}
