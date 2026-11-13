import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GET as listCases } from '../../src/app/api/cases/route';
import { POST as lookupCase } from '../../src/app/api/cases/lookup/route';
import { GET as getCase } from '../../src/app/api/cases/[id]/route';
import { DELETE as unsubscribe, POST as subscribe } from '../../src/app/api/cases/[id]/subscribe/route';
import { GET as getHearings } from '../../src/app/api/cases/[id]/hearings/route';
import { POST as refreshCase } from '../../src/app/api/cases/[id]/refresh/route';
import { POST as runJobRoute } from '../../src/app/api/jobs/run/route';
import { resetECourtsClient, setECourtsOutage } from '../../src/server/adapters/ecourts';
import { closeDb, getDb } from '../../src/server/db/client';
import { createRepositories } from '../../src/server/db/repositories';
import { runSeed } from '../../src/server/db/seed';
import { createSessionToken } from '../../src/server/lib/tokens';
import { resetCasesService } from '../../src/server/modules/cases';
import { resetDraftsService } from '../../src/server/modules/drafts';

/**
 * Case tracking API (Phase 6, AGENTS.md §6, §7, §11, §12).
 *
 * Route handlers are called directly against an in-memory database; the eCourts
 * mock answers from fixtures so no network is involved.
 */

const ORIGIN = 'http://localhost:3000';
const CSRF_TOKEN = 'api-cases-csrf-token';
const CNR = 'RJJP010012342022';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  token?: string;
  csrf?: boolean;
}

function apiRequest(path: string, options: RequestOptions = {}): Request {
  const headers: Record<string, string> = { origin: ORIGIN, 'accept-language': 'en' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) {
    headers.cookie = `lawtrack_session=${encodeURIComponent(options.token)}; lawtrack_csrf=${CSRF_TOKEN}`;
  }
  if (options.csrf) headers['x-csrf-token'] = CSRF_TOKEN;

  return new Request(`${ORIGIN}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function idContext(id: number): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: String(id) }) };
}

interface CaseBody {
  case: {
    id: number;
    cnr: string;
    status: string;
    nextHearingDate: string | null;
    stale: boolean;
    subscribed: boolean;
    hearings: { purpose: string; orderSummary: string | null }[];
  };
  cached?: boolean;
  stale?: boolean;
}

let citizenToken = '';
let otherCitizenToken = '';
let lawyerToken = '';
let adminToken = '';

async function tokenFor(
  email: string,
  role: 'Citizen' | 'Lawyer' | 'Administrator',
): Promise<string> {
  const user = await createRepositories(getDb()).users.findByEmail(email);
  if (!user) throw new Error(`missing seeded account ${email}`);
  return createSessionToken({
    sub: String(user.user_id),
    role,
    email: user.email,
    name: user.name,
    language: 'English',
  });
}

beforeAll(async () => {
  await runSeed({ handle: getDb(), includeDemoAccounts: true });
  resetCasesService();
  resetDraftsService();
  resetECourtsClient();

  citizenToken = await tokenFor('citizen@lawtrack.demo', 'Citizen');
  lawyerToken = await tokenFor('lawyer@lawtrack.demo', 'Lawyer');
  adminToken = await tokenFor('admin@lawtrack.demo', 'Administrator');

  const repos = createRepositories(getDb());
  const second = await repos.users.insert({
    name: 'Case API Citizen',
    email: 'cases.api.second@lawtrack.test',
    passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    role: 'Citizen',
    language: 'English',
    isVerified: true,
  });
  await repos.users.insertCitizen(second.user_id, { state: 'Rajasthan' });
  otherCitizenToken = await createSessionToken({
    sub: String(second.user_id),
    role: 'Citizen',
    email: second.email,
    name: second.name,
    language: 'English',
  });
});

afterAll(async () => {
  resetECourtsClient();
  await closeDb();
});

describe('case tracking API', () => {
  it('looks up a CNR, subscribes the citizen and returns the hearing timeline', async () => {
    const response = await lookupCase(
      apiRequest('/api/cases/lookup', { method: 'POST', body: { cnr: CNR }, token: citizenToken, csrf: true }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as CaseBody;

    expect(body.case.cnr).toBe(CNR);
    expect(body.case.status).toBe('Pending');
    expect(body.case.subscribed).toBe(true);
    expect(body.case.hearings.length).toBeGreaterThan(0);
    expect(body.case.hearings[0]?.orderSummary).toBeTruthy();

    const hearings = await getHearings(
      apiRequest(`/api/cases/${body.case.id}/hearings`, { token: citizenToken }),
      idContext(body.case.id),
    );
    expect(hearings.status).toBe(200);
    const hearingBody = (await hearings.json()) as { hearings: unknown[] };
    expect(hearingBody.hearings.length).toBe(body.case.hearings.length);
  });

  it('serves the second lookup from the 15-minute cache', async () => {
    const first = await lookupCase(
      apiRequest('/api/cases/lookup', { method: 'POST', body: { cnr: CNR }, token: citizenToken, csrf: true }),
    );
    const second = await lookupCase(
      apiRequest('/api/cases/lookup', { method: 'POST', body: { cnr: 'rjjp010012342022' }, token: citizenToken, csrf: true }),
    );

    const firstBody = (await first.json()) as CaseBody;
    const secondBody = (await second.json()) as CaseBody;
    expect(secondBody.cached).toBe(true);
    expect(secondBody.case.id).toBe(firstBody.case.id);

    const rows = await createRepositories(getDb()).cases.findAll();
    expect(rows.filter((row) => row.cnr_number === CNR)).toHaveLength(1);
  });

  it('rejects a malformed CNR with 422 and creates no row', async () => {
    const before = (await createRepositories(getDb()).cases.findAll()).length;
    const response = await lookupCase(
      apiRequest('/api/cases/lookup', {
        method: 'POST',
        body: { cnr: 'RJJP0100123420' },
        token: citizenToken,
        csrf: true,
      }),
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      error: { code: string; fields: { field: string; code: string }[] };
    };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.fields[0]?.field).toBe('cnr');
    expect(body.error.fields[0]?.code).toBe('FORMAT');

    const after = await createRepositories(getDb()).cases.findAll();
    expect(after).toHaveLength(before);
  });

  it('returns 404 for a CNR the court has no record of', async () => {
    const response = await lookupCase(
      apiRequest('/api/cases/lookup', {
        method: 'POST',
        body: { cnr: 'ZZZZ999999999999' },
        token: citizenToken,
        csrf: true,
      }),
    );
    expect(response.status).toBe(404);
  });

  it('blocks a citizen from another citizen’s case', async () => {
    const mine = await lookupCase(
      apiRequest('/api/cases/lookup', { method: 'POST', body: { cnr: CNR }, token: citizenToken, csrf: true }),
    );
    const { case: tracked } = (await mine.json()) as CaseBody;

    const denied = await getCase(
      apiRequest(`/api/cases/${tracked.id}`, { token: otherCitizenToken }),
      idContext(tracked.id),
    );
    expect(denied.status).toBe(404);
  });

  it('unsubscribes and re-subscribes through the toggle', async () => {
    const list = await listCases(apiRequest('/api/cases', { token: citizenToken }));
    const { cases } = (await list.json()) as { cases: { id: number }[] };
    const caseId = cases[0]?.id;
    expect(caseId).toBeTypeOf('number');

    const removed = await unsubscribe(
      apiRequest(`/api/cases/${caseId}/subscribe`, { method: 'DELETE', token: citizenToken, csrf: true }),
      idContext(caseId as number),
    );
    expect(((await removed.json()) as { subscribed: boolean }).subscribed).toBe(false);

    const added = await subscribe(
      apiRequest(`/api/cases/${caseId}/subscribe`, { method: 'POST', token: citizenToken, csrf: true }),
      idContext(caseId as number),
    );
    expect(((await added.json()) as { subscribed: boolean }).subscribed).toBe(true);
  });

  it('rejects non-citizen roles with 403', async () => {
    const response = await lookupCase(
      apiRequest('/api/cases/lookup', { method: 'POST', body: { cnr: CNR }, token: lawyerToken, csrf: true }),
    );
    expect(response.status).toBe(403);
  });

  it('degrades the integration and returns 502 when eCourts is down', async () => {
    setECourtsOutage(true);
    try {
      const response = await lookupCase(
        apiRequest('/api/cases/lookup', {
          method: 'POST',
          body: { cnr: 'RJJP060055662023' },
          token: citizenToken,
          csrf: true,
        }),
      );
      expect(response.status).toBe(502);

      const integration = await createRepositories(getDb()).integrations.findById(1);
      expect(integration?.status).not.toBe('Healthy');
      expect(integration?.error_count).toBeGreaterThan(0);
    } finally {
      setECourtsOutage(false);
    }
  });

  it('refreshes a tracked case and keeps the saved copy during an outage', async () => {
    const mine = await lookupCase(
      apiRequest('/api/cases/lookup', { method: 'POST', body: { cnr: CNR }, token: citizenToken, csrf: true }),
    );
    const { case: tracked } = (await mine.json()) as CaseBody;

    const refreshed = await refreshCase(
      apiRequest(`/api/cases/${tracked.id}/refresh`, {
        method: 'POST',
        token: citizenToken,
        csrf: true,
      }),
      idContext(tracked.id),
    );
    expect(refreshed.status).toBe(200);
    const freshBody = (await refreshed.json()) as CaseBody;
    expect(freshBody.case.stale).toBe(false);
    expect(freshBody.case.id).toBe(tracked.id);

    setECourtsOutage(true);
    try {
      const degraded = await refreshCase(
        apiRequest(`/api/cases/${tracked.id}/refresh`, {
          method: 'POST',
          token: citizenToken,
          csrf: true,
        }),
        idContext(tracked.id),
      );
      expect(degraded.status).toBe(200);
      const staleBody = (await degraded.json()) as CaseBody;
      expect(staleBody.case.stale).toBe(true);
      expect(staleBody.case.id).toBe(tracked.id);
      expect(staleBody.case.cnr).toBe(CNR);
    } finally {
      setECourtsOutage(false);
    }
  });

  it('blocks a citizen from refreshing a case they do not track', async () => {
    const mine = await lookupCase(
      apiRequest('/api/cases/lookup', { method: 'POST', body: { cnr: CNR }, token: citizenToken, csrf: true }),
    );
    const { case: tracked } = (await mine.json()) as CaseBody;

    const denied = await refreshCase(
      apiRequest(`/api/cases/${tracked.id}/refresh`, {
        method: 'POST',
        token: otherCitizenToken,
        csrf: true,
      }),
      idContext(tracked.id),
    );
    expect(denied.status).toBe(404);
  });

  it('lets an administrator trigger a background job but not a citizen', async () => {
    const allowed = await runJobRoute(
      apiRequest('/api/jobs/run', {
        method: 'POST',
        body: { job: 'case-sync' },
        token: adminToken,
        csrf: true,
      }),
    );
    expect(allowed.status).toBe(200);
    const outcome = (await allowed.json()) as { job: string; ok: boolean };
    expect(outcome.job).toBe('case-sync');
    expect(outcome.ok).toBe(true);

    const denied = await runJobRoute(
      apiRequest('/api/jobs/run', {
        method: 'POST',
        body: { job: 'case-sync' },
        token: citizenToken,
        csrf: true,
      }),
    );
    expect(denied.status).toBe(403);
  });
});
