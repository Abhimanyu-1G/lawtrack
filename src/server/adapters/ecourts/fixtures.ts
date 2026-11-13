import 'server-only';

import type { ECourtsCase } from './types';

/**
 * Deterministic eCourts fixtures (AGENTS.md §11).
 *
 * These records are invented for the prototype: the names, CNRs and orders are
 * fiction and the UI never presents them as real court data. Every shape the
 * product must survive has an entry: pending with a future date, pending with a
 * stale date, pending with no date listed yet, disposed with a long hearing
 * history, and one CNR that always times out.
 */

export type FixtureBehaviour = 'case' | 'timeout';

export interface ECourtsFixture {
  behaviour: FixtureBehaviour;
  case?: ECourtsCase;
}

export const SAMPLE_ORDER_URL = '/sample-orders/sample-order.pdf';

function order(text: string): { orderText: string; orderUrl: string } {
  return { orderText: text, orderUrl: SAMPLE_ORDER_URL };
}

export const ECOURTS_FIXTURES: Record<string, ECourtsFixture> = {
  // Pending, hearing listed in the near future.
  RJJP010012342022: {
    behaviour: 'case',
    case: {
      cnr: 'RJJP010012342022',
      status: 'Pending',
      caseTitle: 'Sharma vs State of Rajasthan',
      courtName: 'District Court, Jaipur Metropolitan',
      nextHearingDate: '2026-11-19',
      hearings: [
        {
          date: '2026-08-21',
          purpose: 'First appearance',
          ...order(
            'The accused shall appear in person on the next date. Copies of the charge sheet must be supplied to the accused prior to the hearing.',
          ),
        },
        {
          date: '2026-10-09',
          purpose: 'Arguments on charge',
          ...order(
            'Arguments on charge are heard in part. The matter must be listed on the next date for further arguments.',
          ),
        },
      ],
    },
  },

  // Pending with a stale date: the court has not updated the listing.
  RJJP020045672023: {
    behaviour: 'case',
    case: {
      cnr: 'RJJP020045672023',
      status: 'Pending',
      caseTitle: 'Meena Devi vs Rakesh Kumar',
      courtName: 'Family Court, Jaipur',
      nextHearingDate: '2026-04-02',
      hearings: [
        {
          date: '2026-02-11',
          purpose: 'Mediation report',
          ...order(
            'The mediation centre shall submit its report before the next date. Both parties must remain present.',
          ),
        },
      ],
    },
  },

  // Pending, next date not yet listed by the court.
  RJJP030078912021: {
    behaviour: 'case',
    case: {
      cnr: 'RJJP030078912021',
      status: 'Pending',
      caseTitle: 'Vikas Jain vs Jaipur Municipal Corporation',
      courtName: 'Civil Judge Court, Jaipur',
      nextHearingDate: null,
      hearings: [
        {
          date: '2026-09-30',
          purpose: 'Framing of issues',
          ...order('Issues are framed. The matter must be listed after the parties file their documents.'),
        },
      ],
    },
  },

  // Disposed with a long hearing history.
  RJJP040011222020: {
    behaviour: 'case',
    case: {
      cnr: 'RJJP040011222020',
      status: 'Disposed',
      caseTitle: 'Sunita Agarwal vs Rajasthan Housing Board',
      courtName: 'District Court, Jaipur Metropolitan',
      nextHearingDate: null,
      hearings: [
        { date: '2025-11-14', purpose: 'Notice issued', ...order('Notice is issued to the opposite party.') },
        {
          date: '2026-01-16',
          purpose: 'Written statement',
          ...order('The written statement is taken on record. The plaintiff may file a replication.'),
        },
        {
          date: '2026-03-20',
          purpose: 'Evidence',
          ...order('The plaintiff shall produce the original allotment letter on the next date.'),
        },
        {
          date: '2026-06-05',
          purpose: 'Final arguments',
          ...order('Final arguments are heard. Judgment is reserved.'),
        },
        {
          date: '2026-06-26',
          purpose: 'Judgment',
          ...order('The suit is decreed in favour of the plaintiff with costs. The case is disposed of.'),
        },
      ],
    },
  },

  // Pending, one hearing, hearing shortly (reminder window).
  RJJP050033442024: {
    behaviour: 'case',
    case: {
      cnr: 'RJJP050033442024',
      status: 'Pending',
      caseTitle: 'Imran Khan vs National Insurance Co. Ltd.',
      courtName: 'Motor Accident Claims Tribunal, Jaipur',
      nextHearingDate: '2026-11-15',
      hearings: [
        {
          date: '2026-07-08',
          purpose: 'Notice to insurer',
          ...order('Notice is issued to the insurer. The claimant shall file the disability certificate.'),
        },
      ],
    },
  },

  // Pending, future date further out.
  RJJP060055662023: {
    behaviour: 'case',
    case: {
      cnr: 'RJJP060055662023',
      status: 'Pending',
      caseTitle: 'Priya Yadav vs State of Rajasthan',
      courtName: 'District Court, Alwar',
      nextHearingDate: '2027-01-14',
      hearings: [
        {
          date: '2026-05-22',
          purpose: 'Bail application',
          ...order(
            'The bail application is taken up. The applicant shall be produced before the court on the next date.',
          ),
        },
      ],
    },
  },

  // Disposed, short history.
  RJJP070077882022: {
    behaviour: 'case',
    case: {
      cnr: 'RJJP070077882022',
      status: 'Disposed',
      caseTitle: 'Mohan Lal vs Suresh Chand',
      courtName: 'Civil Judge Court, Kota',
      nextHearingDate: null,
      hearings: [
        {
          date: '2026-02-19',
          purpose: 'Compromise',
          ...order('The parties have settled the matter. The suit is dismissed as settled.'),
        },
      ],
    },
  },

  // Pending, stale date (older than a year).
  RJJP080099002021: {
    behaviour: 'case',
    case: {
      cnr: 'RJJP080099002021',
      status: 'Pending',
      caseTitle: 'Rajasthan Traders vs Commercial Taxes Department',
      courtName: 'Commercial Court, Jaipur',
      nextHearingDate: '2025-12-03',
      hearings: [
        {
          date: '2025-10-10',
          purpose: 'Interim application',
          ...order('The interim application is taken on record. Reply is sought from the department.'),
        },
      ],
    },
  },

  // High Court, pending, future date.
  RJPR010023452022: {
    behaviour: 'case',
    case: {
      cnr: 'RJPR010023452022',
      status: 'Pending',
      caseTitle: 'State of Rajasthan vs Ramesh Chand',
      courtName: 'Rajasthan High Court, Jodhpur',
      nextHearingDate: '2026-12-08',
      hearings: [
        {
          date: '2026-09-11',
          purpose: 'Leave to appeal',
          ...order('Leave to appeal is granted. The appeal must be listed for admission.'),
        },
      ],
    },
  },

  // High Court, disposed.
  RJPR020056782023: {
    behaviour: 'case',
    case: {
      cnr: 'RJPR020056782023',
      status: 'Disposed',
      caseTitle: 'Neha Sharma vs University of Rajasthan',
      courtName: 'Rajasthan High Court, Jaipur Bench',
      nextHearingDate: null,
      hearings: [
        {
          date: '2026-04-17',
          purpose: 'Final hearing',
          ...order('The writ petition is allowed. The university shall re-evaluate the answer script.'),
        },
      ],
    },
  },

  // Another state, pending.
  DLCT010087652022: {
    behaviour: 'case',
    case: {
      cnr: 'DLCT010087652022',
      status: 'Pending',
      caseTitle: 'Anil Gupta vs Delhi Development Authority',
      courtName: 'District Court, Tis Hazari, Delhi',
      nextHearingDate: '2026-11-27',
      hearings: [
        {
          date: '2026-06-12',
          purpose: 'Documents',
          ...order('The plaintiff shall file the possession letter and the payment receipts.'),
        },
      ],
    },
  },

  // Pending with no next date listed.
  MHMU030034562024: {
    behaviour: 'case',
    case: {
      cnr: 'MHMU030034562024',
      status: 'Pending',
      caseTitle: 'Farida Shaikh vs Sunrise Developers',
      courtName: 'City Civil Court, Mumbai',
      nextHearingDate: null,
      hearings: [],
    },
  },

  // Always times out — the UI must degrade gracefully.
  RJJP090011112022: { behaviour: 'timeout' },
};

/** CNR used by the API-manager "Check now" button and the health job. */
export const ECOURTS_PROBE_CNR = 'RJJP010012342022';

export function findFixture(cnr: string): ECourtsFixture | undefined {
  return ECOURTS_FIXTURES[cnr];
}
