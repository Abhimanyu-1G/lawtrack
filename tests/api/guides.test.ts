import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GET as listGuides } from '../../src/app/api/guides/route';
import { GET as listCategories } from '../../src/app/api/guides/categories/route';
import { GET as getGuide } from '../../src/app/api/guides/[id]/route';
import { GET as curatorList } from '../../src/app/api/curator/guides/route';
import { PATCH as curatorUpdate } from '../../src/app/api/curator/guides/[id]/route';
import { POST as curatorValidate } from '../../src/app/api/curator/guides/[id]/validate/route';
import { POST as curatorFlag } from '../../src/app/api/curator/guides/[id]/flag/route';
import { POST as curatorResimplify } from '../../src/app/api/curator/guides/[id]/resimplify/route';
import { closeDb, getDb } from '../../src/server/db/client';
import { createRepositories } from '../../src/server/db/repositories';
import { runSeed } from '../../src/server/db/seed';
import { DEMO_ACCOUNT_EMAILS } from '../../src/server/db/seed/users';
import { createSessionToken } from '../../src/server/lib/tokens';
import { resetGuidesService } from '../../src/server/modules/guides';

/**
 * Guide + curator route-handler flow (Phase 3, AGENTS.md §17): public browsing,
 * Valid-only visibility, view tracking, RBAC/CSRF and the curator edit →
 * validate / flag lifecycle. Route handlers are called directly — no server.
 */

const ORIGIN = 'http://localhost:3000';
const CSRF_TOKEN = 'api-guide-csrf-token';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  token?: string;
  csrf?: boolean;
  origin?: string;
}

function apiRequest(path: string, options: RequestOptions = {}): Request {
  const headers: Record<string, string> = { origin: options.origin ?? ORIGIN };
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

function guideContext(id: number): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: String(id) }) };
}

let curatorToken = '';
let citizenToken = '';
let curatorId = 0;
let citizenId = 0;

async function sessionFor(email: string, role: 'Curator' | 'Citizen'): Promise<{ id: number; token: string }> {
  const user = await createRepositories(getDb()).users.findByEmail(email);
  if (!user) throw new Error(`missing seeded account ${email}`);

  const token = await createSessionToken({
    sub: String(user.user_id),
    role,
    email: user.email,
    name: user.name,
    language: 'English',
  });
  return { id: user.user_id, token };
}

async function guideIdFor(topicKey: string, language: 'English' | 'Hindi'): Promise<number> {
  const row = await getDb()
    .db.selectFrom('Legal_Guide')
    .select('guide_id')
    .where('topic_key', '=', topicKey)
    .where('language', '=', language)
    .executeTakeFirst();
  if (!row) throw new Error(`missing guide ${topicKey}/${language}`);
  return row.guide_id;
}

beforeAll(async () => {
  await runSeed({ handle: getDb(), includeDemoAccounts: true });
  resetGuidesService();

  const curator = await sessionFor(DEMO_ACCOUNT_EMAILS[2] ?? 'curator@lawtrack.demo', 'Curator');
  const citizen = await sessionFor(DEMO_ACCOUNT_EMAILS[0] ?? 'citizen@lawtrack.demo', 'Citizen');
  curatorToken = curator.token;
  curatorId = curator.id;
  citizenToken = citizen.token;
  citizenId = citizen.id;
});

afterAll(async () => {
  resetGuidesService();
  await closeDb();
});

describe('guides API', () => {
  it('UT_GD_API_01 public list, categories and detail expose Valid guides only', async () => {
    const response = await listGuides(apiRequest('/api/guides?lang=en&pageSize=50'));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      guides: { status: string }[];
      total: number;
      totalPages: number;
    };
    expect(body.total).toBe(15);
    expect(body.guides.every((guide) => guide.status === 'Valid')).toBe(true);

    const categoriesResponse = await listCategories(apiRequest('/api/guides/categories?lang=en'));
    expect(categoriesResponse.status).toBe(200);
    const categoriesBody = (await categoriesResponse.json()) as {
      categories: { category: string; count: number }[];
    };
    expect(categoriesBody.categories).toHaveLength(9);
    expect(categoriesBody.categories.reduce((sum, entry) => sum + entry.count, 0)).toBe(15);

    const draft = await getDb()
      .db.selectFrom('Legal_Guide')
      .select('guide_id')
      .where('validation_status', '=', 'Draft')
      .executeTakeFirst();
    if (!draft) throw new Error('seed is missing a Draft guide');

    const hidden = await getGuide(
      apiRequest(`/api/guides/${draft.guide_id}`),
      guideContext(draft.guide_id),
    );
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('UT_GD_API_02 a citizen guide view is recorded for "continue reading"', async () => {
    const guideId = await guideIdFor('consumer-complaint', 'English');

    const response = await getGuide(
      apiRequest(`/api/guides/${guideId}`, { token: citizenToken }),
      guideContext(guideId),
    );
    expect(response.status).toBe(200);

    const citizen = await getDb()
      .db.selectFrom('Citizen')
      .select('last_viewed_guide_id')
      .where('user_id', '=', citizenId)
      .executeTakeFirst();
    expect(citizen?.last_viewed_guide_id).toBe(guideId);

    const views = await getDb()
      .db.selectFrom('Guide_View')
      .select('guide_id')
      .where('citizen_id', '=', citizenId)
      .execute();
    expect(views.some((row) => row.guide_id === guideId)).toBe(true);
  });

  it('UT_GD_API_03 curator routes enforce role, session and CSRF', async () => {
    const citizenAttempt = await curatorList(
      apiRequest('/api/curator/guides', { token: citizenToken }),
    );
    expect(citizenAttempt.status).toBe(403);
    expect(await citizenAttempt.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });

    const guideId = await guideIdFor('traffic-challan', 'English');

    const anonymous = await curatorUpdate(
      apiRequest(`/api/curator/guides/${guideId}`, {
        method: 'PATCH',
        body: { title: 'Anonymous edit attempt' },
      }),
      guideContext(guideId),
    );
    expect(anonymous.status).toBe(401);

    const withoutCsrf = await curatorUpdate(
      apiRequest(`/api/curator/guides/${guideId}`, {
        method: 'PATCH',
        token: curatorToken,
        body: { title: 'No CSRF token' },
      }),
      guideContext(guideId),
    );
    expect(withoutCsrf.status).toBe(403);

    const crossOrigin = await curatorUpdate(
      apiRequest(`/api/curator/guides/${guideId}`, {
        method: 'PATCH',
        token: curatorToken,
        csrf: true,
        origin: 'http://evil.example',
        body: { title: 'Cross origin edit' },
      }),
      guideContext(guideId),
    );
    expect(crossOrigin.status).toBe(403);
    expect(await crossOrigin.json()).toMatchObject({ error: { code: 'FORBIDDEN_ORIGIN' } });
  });

  it('UT_GD_API_04 a curator edits a draft and publishes it', async () => {
    const guideId = await guideIdFor('labour-maternity', 'English');

    const edited = await curatorUpdate(
      apiRequest(`/api/curator/guides/${guideId}`, {
        method: 'PATCH',
        token: curatorToken,
        csrf: true,
        body: {
          title: 'Maternity benefits: leave, pay and notice',
          plain_summary:
            'Eligible women workers can claim paid maternity leave, a medical bonus and protection from dismissal during leave. Tell your employer in writing with the expected delivery date and keep copies of the notice, appointment letter and salary slips. The Maternity Benefit Act, 1961 sets the framework; a lawyer can help if the employer refuses.',
          source_statute: 'Maternity Benefit Act, 1961: sections 4, 5, 6, 12 and 27',
          source_excerpt:
            'Section 4 provides maternity benefit, section 5 sets the rate, section 6 deals with notice and section 12 protects a woman from dismissal during maternity leave.',
        },
      }),
      guideContext(guideId),
    );
    expect(edited.status).toBe(200);
    const editedBody = (await edited.json()) as { guide: { title: string; status: string } };
    expect(editedBody.guide.title).toBe('Maternity benefits: leave, pay and notice');
    expect(editedBody.guide.status).toBe('Draft');

    const validated = await curatorValidate(
      apiRequest(`/api/curator/guides/${guideId}/validate`, {
        method: 'POST',
        token: curatorToken,
        csrf: true,
      }),
      guideContext(guideId),
    );
    expect(validated.status).toBe(200);
    expect(await validated.json()).toMatchObject({ guide: { id: guideId, status: 'Valid' } });

    const publicDetail = await getGuide(
      apiRequest(`/api/guides/${guideId}`),
      guideContext(guideId),
    );
    expect(publicDetail.status).toBe(200);

    const audit = await createRepositories(getDb()).audit.list({ action: 'GUIDE_VALIDATED' });
    expect(audit.items.some((row) => row.performed_by === curatorId)).toBe(true);
  });

  it('UT_GD_API_05 flagging hides a guide while re-simplify only returns a suggestion', async () => {
    const flagTarget = await guideIdFor('property-inheritance', 'English');
    const resimplifyTarget = await guideIdFor('bns-bail', 'English');
    const before = await getDb()
      .db.selectFrom('Legal_Guide')
      .select('plain_summary')
      .where('guide_id', '=', resimplifyTarget)
      .executeTakeFirstOrThrow();

    const suggestionResponse = await curatorResimplify(
      apiRequest(`/api/curator/guides/${resimplifyTarget}/resimplify`, {
        method: 'POST',
        token: curatorToken,
        csrf: true,
      }),
      guideContext(resimplifyTarget),
    );
    expect(suggestionResponse.status).toBe(200);
    expect(await suggestionResponse.json()).toMatchObject({
      suggestion: { demo: true, model: 'demo-simplify-v1' },
    });

    const after = await getDb()
      .db.selectFrom('Legal_Guide')
      .select('plain_summary')
      .where('guide_id', '=', resimplifyTarget)
      .executeTakeFirstOrThrow();
    expect(after.plain_summary).toBe(before.plain_summary);

    const flagged = await curatorFlag(
      apiRequest(`/api/curator/guides/${flagTarget}/flag`, {
        method: 'POST',
        token: curatorToken,
        csrf: true,
        body: { reason: 'State mutation procedure changed in 2026.' },
      }),
      guideContext(flagTarget),
    );
    expect(flagged.status).toBe(200);
    expect(await flagged.json()).toMatchObject({
      guide: { id: flagTarget, status: 'Requires AI Update' },
    });

    const hidden = await getGuide(
      apiRequest(`/api/guides/${flagTarget}`),
      guideContext(flagTarget),
    );
    expect(hidden.status).toBe(404);
  });
});
