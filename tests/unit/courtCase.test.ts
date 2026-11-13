import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ValidationCode, ValidationResult } from '../../src/shared/errors';
import {
  CASE_TITLE_MAX,
  COURT_NAME_MAX,
  validateCourtCaseInput,
  type CourtCaseInput,
} from '../../src/shared/validation';
import { createMockAiProvider } from '../../src/server/adapters/ai/mock';
import {
  ECourtsTimeoutError,
  type ECourtsCase,
  type ECourtsClient,
} from '../../src/server/adapters/ecourts/types';
import type { LawTrackDatabase } from '../../src/server/db/client';
import { createInMemoryDatabase } from '../../src/server/db/memory';
import { createRepositories } from '../../src/server/db/repositories';
import { runSeed } from '../../src/server/db/seed';
import { isAppError } from '../../src/server/lib/errors';
import { createCasesService } from '../../src/server/modules/cases/service';
import { createFixedClock, toKolkataDate, toUtcTimestamp } from '../../src/shared/clock';
import { createValidationContext, withoutField } from '../helpers/validation';

const baseCase: Record<string, unknown> = {
  integration_id: 1,
  cnr_number: 'RJJP010012342022',
  case_title: 'Sharma vs State of Rajasthan',
  court_name: 'District Court, Jaipur',
  status: 'Pending',
  next_hearing_date: '2026-11-11',
  last_synced_at: '2026-11-10 12:00:00',
};

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...baseCase, ...overrides };
}

function firstIssue(result: ValidationResult<unknown>, field: string): ValidationCode | undefined {
  return result.ok ? undefined : result.errors.find((error) => error.field === field)?.code;
}

function expectIssue(result: ValidationResult<unknown>, field: string, code: ValidationCode): void {
  expect(result.ok, `expected ${field} to fail with ${code}`).toBe(false);
  expect(firstIssue(result, field), JSON.stringify(result)).toBe(code);
}

function expectValue(result: ValidationResult<CourtCaseInput>): CourtCaseInput {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error('unreachable');
  return result.value;
}

describe('Court case validation (UT_CSE)', () => {
  const context = createValidationContext();

  it('UT_CSE_01 integration_id accepts an existing integration', async () => {
    expect(
      expectValue(await validateCourtCaseInput(input({ integration_id: 1 }), context)).integration_id,
    ).toBe(1);
  });

  it('UT_CSE_02 integration_id rejects 9999 with FK_NOT_FOUND', async () => {
    expectIssue(
      await validateCourtCaseInput(input({ integration_id: 9999 }), context),
      'integration_id',
      'FK_NOT_FOUND',
    );
  });

  it('UT_CSE_03 integration_id rejects an empty value with REQUIRED', async () => {
    expectIssue(
      await validateCourtCaseInput(withoutField(input(), 'integration_id'), context),
      'integration_id',
      'REQUIRED',
    );
  });

  it('UT_CSE_04 cnr_number accepts RJJP010012342022', async () => {
    expect(
      expectValue(await validateCourtCaseInput(input({ cnr_number: 'RJJP010012342022' }), context))
        .cnr_number,
    ).toBe('RJJP010012342022');
  });

  it('UT_CSE_05 cnr_number rejects a 15-character value with FORMAT', async () => {
    expectIssue(
      await validateCourtCaseInput(input({ cnr_number: 'RJJP01001234202' }), context),
      'cnr_number',
      'FORMAT',
    );
  });

  it('UT_CSE_06 cnr_number rejects separators with FORMAT', async () => {
    expectIssue(
      await validateCourtCaseInput(input({ cnr_number: 'RJJP-10012342022' }), context),
      'cnr_number',
      'FORMAT',
    );
  });

  it('UT_CSE_07 case_title accepts a normal title', async () => {
    expect(
      expectValue(
        await validateCourtCaseInput(input({ case_title: 'Sharma vs State of Rajasthan' }), context),
      ).case_title,
    ).toBe('Sharma vs State of Rajasthan');
  });

  it('UT_CSE_08 case_title rejects an empty value with REQUIRED', async () => {
    expectIssue(await validateCourtCaseInput(input({ case_title: '' }), context), 'case_title', 'REQUIRED');
  });

  it('UT_CSE_09 case_title rejects 201 characters with LENGTH', async () => {
    expectIssue(
      await validateCourtCaseInput(input({ case_title: 'x'.repeat(CASE_TITLE_MAX + 1) }), context),
      'case_title',
      'LENGTH',
    );
  });

  it('UT_CSE_10 court_name accepts a normal court name', async () => {
    expect(
      expectValue(await validateCourtCaseInput(input({ court_name: 'District Court, Jaipur' }), context))
        .court_name,
    ).toBe('District Court, Jaipur');
  });

  it('UT_CSE_11 court_name rejects an empty value with REQUIRED', async () => {
    expectIssue(await validateCourtCaseInput(input({ court_name: '' }), context), 'court_name', 'REQUIRED');
  });

  it('UT_CSE_12 court_name rejects 121 characters with LENGTH', async () => {
    expectIssue(
      await validateCourtCaseInput(input({ court_name: 'x'.repeat(COURT_NAME_MAX + 1) }), context),
      'court_name',
      'LENGTH',
    );
  });

  it('UT_CSE_13 status accepts Pending', async () => {
    expect(expectValue(await validateCourtCaseInput(input({ status: 'Pending' }), context)).status).toBe(
      'Pending',
    );
  });

  it('UT_CSE_14 status rejects a blank value with REQUIRED', async () => {
    expectIssue(await validateCourtCaseInput(input({ status: '' }), context), 'status', 'REQUIRED');
  });

  it('UT_CSE_15 status rejects Closed with ENUM', async () => {
    expectIssue(await validateCourtCaseInput(input({ status: 'Closed' }), context), 'status', 'ENUM');
  });

  it('UT_CSE_16 next_hearing_date accepts tomorrow for a pending case', async () => {
    expect(
      expectValue(await validateCourtCaseInput(input({ next_hearing_date: '2026-11-11' }), context))
        .next_hearing_date,
    ).toBe('2026-11-11');
  });

  it('UT_CSE_17 next_hearing_date rejects yesterday for a pending case with PAST_DATE', async () => {
    expectIssue(
      await validateCourtCaseInput(input({ next_hearing_date: '2026-11-09' }), context),
      'next_hearing_date',
      'PAST_DATE',
    );
  });

  it('UT_CSE_18 next_hearing_date rejects 2026-02-30 with INVALID_DATE', async () => {
    expectIssue(
      await validateCourtCaseInput(input({ next_hearing_date: '2026-02-30' }), context),
      'next_hearing_date',
      'INVALID_DATE',
    );
  });

  it('UT_CSE_19 last_synced_at accepts now', async () => {
    expect(
      expectValue(await validateCourtCaseInput(input({ last_synced_at: '2026-11-10 12:00:00' }), context))
        .last_synced_at,
    ).toBe('2026-11-10 12:00:00');
  });

  it('UT_CSE_20 last_synced_at rejects tomorrow with FUTURE_DATE', async () => {
    expectIssue(
      await validateCourtCaseInput(input({ last_synced_at: '2026-11-11 12:00:00' }), context),
      'last_synced_at',
      'FUTURE_DATE',
    );
  });

  it('UT_CSE_21 last_synced_at rejects an impossible datetime with INVALID_DATE', async () => {
    expectIssue(
      await validateCourtCaseInput(input({ last_synced_at: '2026-13-45 10:00:00' }), context),
      'last_synced_at',
      'INVALID_DATE',
    );
  });

  it('UT_CSE_25 next_hearing_date accepts today for a pending case', async () => {
    expect(
      expectValue(await validateCourtCaseInput(input({ next_hearing_date: '2026-11-10' }), context))
        .next_hearing_date,
    ).toBe('2026-11-10');
  });

  it('UT_CSE_26 manual validation requires a date for a pending case', async () => {
    expectIssue(
      await validateCourtCaseInput(withoutField(input(), 'next_hearing_date'), context),
      'next_hearing_date',
      'REQUIRED',
    );
  });

  it('UT_CSE_27 sync validation accepts a missing date for a pending case', async () => {
    const value = expectValue(
      await validateCourtCaseInput(withoutField(input(), 'next_hearing_date'), context, {
        source: 'sync',
      }),
    );
    expect(value.next_hearing_date).toBeNull();
  });

  it('UT_CSE_28 disposed cases may omit the next hearing date', async () => {
    const value = expectValue(
      await validateCourtCaseInput(input({ status: 'Disposed', next_hearing_date: null }), context),
    );
    expect(value.next_hearing_date).toBeNull();
  });

  it('UT_CSE_29 sync validation accepts a stale date from eCourts', async () => {
    expect(
      expectValue(
        await validateCourtCaseInput(input({ next_hearing_date: '2026-01-01' }), context, {
          source: 'sync',
        }),
      ).next_hearing_date,
    ).toBe('2026-01-01');
  });

  it('UT_CSE_30 case_title accepts exactly 200 characters', async () => {
    expect(
      expectValue(await validateCourtCaseInput(input({ case_title: 'x'.repeat(200) }), context)).case_title,
    ).toHaveLength(CASE_TITLE_MAX);
  });

  it('UT_CSE_31 court_name accepts exactly 120 characters', async () => {
    expect(
      expectValue(await validateCourtCaseInput(input({ court_name: 'x'.repeat(120) }), context)).court_name,
    ).toHaveLength(COURT_NAME_MAX);
  });

  it('UT_CSE_32 lowercase CNRs are normalised and treated as duplicates', async () => {
    const tracked = createValidationContext({ cnrs: ['RJJP010012342022'] });
    expectIssue(
      await validateCourtCaseInput(input({ cnr_number: 'rjjp010012342022' }), tracked),
      'cnr_number',
      'UNIQUE',
    );
  });
});

/* ------------------------------------------------------------------------ */
/* Service-level rules with an in-memory database and a fake eCourts client  */
/* ------------------------------------------------------------------------ */

const SERVICE_CNR = 'RJJP010012342022';

function mutableClock(at: string) {
  let current = createFixedClock(at).now();
  return {
    now: () => new Date(current.getTime()),
    nowIso: () => toUtcTimestamp(new Date(current.getTime())),
    today: () => toKolkataDate(new Date(current.getTime())),
    timestamp: (value: Date) => toUtcTimestamp(value),
    advance: (milliseconds: number) => {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}

function pendingCase(overrides: Partial<ECourtsCase> = {}): ECourtsCase {
  return {
    cnr: SERVICE_CNR,
    status: 'Pending',
    caseTitle: 'Sharma vs State of Rajasthan',
    courtName: 'District Court, Jaipur',
    nextHearingDate: '2026-11-12',
    hearings: [
      {
        date: '2026-10-15',
        purpose: 'Arguments on charge',
        orderText: 'The matter shall be listed prior to the next date for arguments.',
        orderUrl: null,
      },
    ],
    ...overrides,
  };
}

describe('Court case service (UT_CSE 22-38)', () => {
  let handle: LawTrackDatabase | undefined;

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });

  async function setup(
    adapter: ECourtsClient,
    options: { cacheMinutes?: number; clock?: ReturnType<typeof mutableClock> } = {},
  ) {
    handle = createInMemoryDatabase();
    const clock = options.clock ?? mutableClock('2026-11-10 12:00:00');
    const repos = createRepositories(handle);
    await runSeed({ handle, clock, includeDemoAccounts: true });

    const citizen = await repos.users.findByEmail('citizen@lawtrack.demo');
    if (!citizen) throw new Error('seed did not create the citizen');

    const service = createCasesService({
      repos,
      clock,
      ai: createMockAiProvider(),
      ecourts: adapter,
      cacheMinutes: options.cacheMinutes,
    });

    return { repos, service, clock, citizenId: citizen.user_id };
  }

  it('UT_CSE_22 fetchByCNR stores one row and serves the second call from storage', async () => {
    const adapter: ECourtsClient = { name: 'stub', getCaseByCnr: vi.fn(async () => pendingCase()) };
    const { service, repos, citizenId } = await setup(adapter);

    const first = await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en');
    const second = await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en');

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.case.id).toBe(first.case.id);
    expect(adapter.getCaseByCnr).toHaveBeenCalledTimes(1);

    const rows = await repos.cases.findAll();
    expect(rows.filter((row) => row.cnr_number === SERVICE_CNR)).toHaveLength(1);
  });

  it('UT_CSE_23 fetchByCNR rejects a 15-character CNR with zero adapter calls', async () => {
    const adapter: ECourtsClient = { name: 'stub', getCaseByCnr: vi.fn(async () => pendingCase()) };
    const { service, citizenId } = await setup(adapter);

    const error = await service
      .fetchByCNR(citizenId, { cnr: 'RJJP01001234202' }, 'en')
      .catch((thrown: unknown) => thrown);

    expect(isAppError(error)).toBe(true);
    if (isAppError(error)) {
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.fields?.[0]?.field).toBe('cnr');
      expect(error.fields?.[0]?.code).toBe('FORMAT');
    }
    expect(adapter.getCaseByCnr).toHaveBeenCalledTimes(0);
  });

  it('UT_CSE_24 refreshFromAPI applies Disposed and updates last_synced_at', async () => {
    let current = pendingCase();
    const adapter: ECourtsClient = { name: 'stub', getCaseByCnr: vi.fn(async () => current) };
    const { service, repos, citizenId, clock } = await setup(adapter);

    const first = await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en');
    const syncedAt = first.case.lastSyncedAt;

    clock.advance(60 * 60 * 1000);
    current = pendingCase({
      status: 'Disposed',
      nextHearingDate: null,
      hearings: [
        ...current.hearings,
        { date: '2026-11-12', purpose: 'Final order', orderText: 'The case is disposed of.', orderUrl: null },
      ],
    });

    const refreshed = await service.refreshFromAPI(first.case.id, 'en');
    expect(refreshed.status).toBe('Disposed');
    expect(refreshed.lastSyncedAt).not.toBe(syncedAt);

    const row = await repos.cases.findById(first.case.id);
    expect(row?.status).toBe('Disposed');
    expect(row?.next_hearing_date).toBeNull();
  });

  it('UT_CSE_33 three adapter failures move eCourts to Degraded and then Down', async () => {
    const adapter: ECourtsClient = {
      name: 'stub',
      getCaseByCnr: vi.fn(async () => {
        throw new ECourtsTimeoutError('timed out');
      }),
    };
    const { service, repos, citizenId } = await setup(adapter);

    for (const expected of ['Degraded', 'Degraded', 'Down'] as const) {
      await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en').catch(() => undefined);
      const integration = await repos.integrations.findById(1);
      expect(integration?.status).toBe(expected);
    }

    const integration = await repos.integrations.findById(1);
    expect(integration?.error_count).toBe(3);
  });

  it('UT_CSE_34 a successful call resets the error count and marks eCourts Healthy', async () => {
    let fail = true;
    const adapter: ECourtsClient = {
      name: 'stub',
      getCaseByCnr: vi.fn(async () => {
        if (fail) throw new ECourtsTimeoutError('timed out');
        return pendingCase();
      }),
    };
    const { service, repos, citizenId } = await setup(adapter);

    await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en').catch(() => undefined);
    expect((await repos.integrations.findById(1))?.error_count).toBe(1);

    fail = false;
    await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en');

    const integration = await repos.integrations.findById(1);
    expect(integration?.status).toBe('Healthy');
    expect(integration?.error_count).toBe(0);
    expect(integration?.last_sync_time).toBeTruthy();
  });

  it('UT_CSE_35 hearing reminders fire once per case and date', async () => {
    const adapter: ECourtsClient = { name: 'stub', getCaseByCnr: vi.fn(async () => pendingCase()) };
    const { service, repos, citizenId } = await setup(adapter);

    await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en');

    await service.sendHearingReminders();
    const afterFirst = await repos.notifications.listForUser(citizenId);

    await service.sendHearingReminders();
    const afterSecond = await repos.notifications.listForUser(citizenId);

    expect(afterFirst.total).toBe(3);
    expect(afterSecond.total).toBe(3);
    expect(afterSecond.items.map((row) => row.channel).sort()).toEqual(['Email', 'In-App', 'SMS']);
  });

  it('UT_CSE_36 a lookup auto-subscribes the citizen and unsubscribe removes it', async () => {
    const adapter: ECourtsClient = { name: 'stub', getCaseByCnr: vi.fn(async () => pendingCase()) };
    const { service, citizenId } = await setup(adapter);

    const lookup = await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en');
    expect(lookup.case.subscribed).toBe(true);
    const tracked = await service.listForCitizen(citizenId);
    expect(tracked.some((row) => row.id === lookup.case.id)).toBe(true);

    await service.unsubscribe(citizenId, lookup.case.id);
    const after = await service.listForCitizen(citizenId);
    expect(after.some((row) => row.id === lookup.case.id)).toBe(false);
  });

  it('UT_CSE_37 an adapter outage returns the stored case with a stale flag', async () => {
    let fail = false;
    const adapter: ECourtsClient = {
      name: 'stub',
      getCaseByCnr: vi.fn(async () => {
        if (fail) throw new ECourtsTimeoutError('timed out');
        return pendingCase();
      }),
    };
    const { service, citizenId } = await setup(adapter, { cacheMinutes: 0 });

    const first = await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en');
    expect(first.stale).toBe(false);

    fail = true;
    const second = await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en');

    expect(second.stale).toBe(true);
    expect(second.case.id).toBe(first.case.id);
    expect(second.case.title).toBe('Sharma vs State of Rajasthan');
  });

  it('UT_CSE_38 a lookup records latency and sync metrics for the dashboards', async () => {
    const adapter: ECourtsClient = { name: 'stub', getCaseByCnr: vi.fn(async () => pendingCase()) };
    const { service, repos, citizenId } = await setup(adapter);

    await service.fetchByCNR(citizenId, { cnr: SERVICE_CNR }, 'en');

    const since = '2020-01-01 00:00:00';
    expect((await repos.metrics.listSince('case_lookup_ms', since)).length).toBeGreaterThan(0);
    expect((await repos.metrics.listSince('case_sync', since)).length).toBeGreaterThan(0);
  });
});
