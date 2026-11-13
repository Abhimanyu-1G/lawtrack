import 'server-only';

/**
 * India Code adapter (AGENTS.md §11, UC-05).
 *
 * Real India Code integration is out of scope for the prototype, so the mock
 * turns a curator/admin supplied change notice into the same payload a webhook
 * would deliver. It never edits guides itself and never invents an Act number:
 * the caller supplies the summary and the adapter only normalises it.
 */

export interface LegislativeChange {
  category: string;
  actName: string | null;
  changeSummary: string;
  effectiveFrom: string | null;
  receivedAt: string;
}

export interface LegislativeChangeNotice {
  category: string;
  changeSummary: string;
  actName?: string | null;
  effectiveFrom?: string | null;
}

export interface IndiaCodeClient {
  readonly mock: boolean;
  simulateChange(notice: LegislativeChangeNotice): Promise<LegislativeChange>;
}

export function createMockIndiaCodeClient(options: { now: () => string }): IndiaCodeClient {
  return {
    mock: true,

    async simulateChange(notice) {
      // Deterministic echo; the 150 ms delay mirrors a real network hop without
      // slowing tests or the demo meaningfully.
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        category: notice.category,
        actName: notice.actName ?? null,
        changeSummary: notice.changeSummary,
        effectiveFrom: notice.effectiveFrom ?? null,
        receivedAt: options.now(),
      };
    },
  };
}
