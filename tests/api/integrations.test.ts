import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { POST as simulateWebhook } from '../../src/app/api/integrations/indiacode/webhook-simulate/route';
import { GET as listNotifications } from '../../src/app/api/notifications/route';
import { POST as markRead } from '../../src/app/api/notifications/[id]/read/route';
import { POST as markAllRead } from '../../src/app/api/notifications/read-all/route';
import { closeDb, getDb } from '../../src/server/db/client';
import { createRepositories } from '../../src/server/db/repositories';
import { runSeed } from '../../src/server/db/seed';
import { createSessionToken } from '../../src/server/lib/tokens';
import { resetIntegrationsService } from '../../src/server/modules/integrations';
import { resetNotificationsService } from '../../src/server/modules/notifications';

/**
 * India Code webhook-simulate (UC-05) and the notification centre (AGENTS.md
 * §11, §13). Route handlers are called directly; no HTTP server, no network.
 */

const ORIGIN = 'http://localhost:3000';
const CSRF_TOKEN = 'api-integrations-csrf-token';
const CATEGORY = 'Consumer Rights';

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
  csrf?: boolean;
}

function apiRequest(path: string, options: RequestOptions = {}): Request {
  const headers: Record<string, string> = { origin: ORIGIN };
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

let adminToken = '';
let managerToken = '';
let managerId = 0;
let citizenToken = '';
let citizenId = 0;

async function sessionFor(
  email: string,
  role: 'Administrator' | 'API Manager' | 'Citizen',
): Promise<{ id: number; token: string }> {
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

beforeAll(async () => {
  await runSeed({ handle: getDb(), includeDemoAccounts: true });
  resetIntegrationsService();
  resetNotificationsService();

  const admin = await sessionFor('admin@lawtrack.demo', 'Administrator');
  const manager = await sessionFor('apimanager@lawtrack.demo', 'API Manager');
  const citizen = await sessionFor('citizen@lawtrack.demo', 'Citizen');
  adminToken = admin.token;
  managerToken = manager.token;
  managerId = manager.id;
  citizenToken = citizen.token;
  citizenId = citizen.id;
});

afterAll(async () => {
  resetIntegrationsService();
  resetNotificationsService();
  await closeDb();
});

describe('India Code webhook + notifications', () => {
  it('UT_INT_API_01 validates the payload and restricts the webhook to admins and API managers', async () => {
    const anonymous = await simulateWebhook(
      apiRequest('/api/integrations/indiacode/webhook-simulate', {
        method: 'POST',
        body: { category: CATEGORY, change_summary: 'A new consumer rule applies.' },
      }),
    );
    expect(anonymous.status).toBe(401);

    const citizenAttempt = await simulateWebhook(
      apiRequest('/api/integrations/indiacode/webhook-simulate', {
        method: 'POST',
        token: citizenToken,
        csrf: true,
        body: { category: CATEGORY, change_summary: 'A new consumer rule applies.' },
      }),
    );
    expect(citizenAttempt.status).toBe(403);

    const unknownCategory = await simulateWebhook(
      apiRequest('/api/integrations/indiacode/webhook-simulate', {
        method: 'POST',
        token: adminToken,
        csrf: true,
        body: { category: 'Space Law', change_summary: 'A new consumer rule applies.' },
      }),
    );
    expect(unknownCategory.status).toBe(422);
    const body = (await unknownCategory.json()) as {
      error: { fields: { field: string; code: string }[] };
    };
    expect(body.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'category', code: 'ENUM' })]),
    );

    const shortSummary = await simulateWebhook(
      apiRequest('/api/integrations/indiacode/webhook-simulate', {
        method: 'POST',
        token: adminToken,
        csrf: true,
        body: { category: CATEGORY, change_summary: 'Too short' },
      }),
    );
    expect(shortSummary.status).toBe(422);
  });

  it('UT_INT_API_02 flags published guides, notifies curators and audits the change', async () => {
    const publishedBefore = await getDb()
      .db.selectFrom('Legal_Guide')
      .select('guide_id')
      .where('category', '=', CATEGORY)
      .where('validation_status', '=', 'Valid')
      .execute();
    expect(publishedBefore.length).toBeGreaterThan(0);

    const response = await simulateWebhook(
      apiRequest('/api/integrations/indiacode/webhook-simulate', {
        method: 'POST',
        token: managerToken,
        csrf: true,
        body: {
          category: CATEGORY,
          change_summary: 'The Consumer Protection (E-Commerce) Rules were amended in 2026.',
          act_name: 'Consumer Protection Act, 2019',
          effective_from: '2026-12-01',
        },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      change: { category: string; actName: string | null };
      flaggedGuides: number;
      notifiedCurators: number;
    };
    expect(body.change.category).toBe(CATEGORY);
    expect(body.change.actName).toBe('Consumer Protection Act, 2019');
    expect(body.flaggedGuides).toBe(publishedBefore.length);
    expect(body.notifiedCurators).toBeGreaterThanOrEqual(1);

    const remaining = await getDb()
      .db.selectFrom('Legal_Guide')
      .select('guide_id')
      .where('category', '=', CATEGORY)
      .where('validation_status', '=', 'Valid')
      .execute();
    expect(remaining).toHaveLength(0);

    const flagged = await getDb()
      .db.selectFrom('Legal_Guide')
      .select('validation_status')
      .where('category', '=', CATEGORY)
      .execute();
    expect(flagged.every((row) => row.validation_status === 'Requires AI Update')).toBe(true);

    const curator = await createRepositories(getDb()).users.findByEmail('curator@lawtrack.demo');
    const notifications = await createRepositories(getDb()).notifications.listForUser(curator?.user_id ?? 0);
    expect(notifications.items.some((row) => row.message.includes('Consumer Rights'))).toBe(true);

    const audit = await createRepositories(getDb()).audit.list({ action: 'GUIDES_FLAGGED_LEGISLATIVE' });
    expect(audit.items.some((row) => row.performed_by === managerId)).toBe(true);

    const integration = await getDb()
      .db.selectFrom('API_Integration')
      .select(['status', 'error_count'])
      .where('integration_id', '=', 3)
      .executeTakeFirstOrThrow();
    expect(integration.status).toBe('Healthy');
    expect(integration.error_count).toBe(0);
  });

  it('UT_INT_API_03 the bell lists newest first and marks one or all as read', async () => {
    const repos = createRepositories(getDb());
    const at = '2026-11-10 12:00:00';

    const first = await repos.notifications.create({
      userId: citizenId,
      message: 'Your draft was approved.',
      channel: 'In-App',
      status: 'Unread',
      timestamp: at,
    });
    await repos.notifications.create({
      userId: citizenId,
      message: 'A hearing is scheduled in 2 days.',
      channel: 'In-App',
      status: 'Unread',
      timestamp: '2026-11-10 13:00:00',
    });

    const list = await listNotifications(apiRequest('/api/notifications?pageSize=10', { token: citizenToken }));
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      notifications: { id: number; message: string; status: string }[];
      unreadCount: number;
      total: number;
    };
    expect(listBody.total).toBeGreaterThanOrEqual(2);
    expect(listBody.unreadCount).toBeGreaterThanOrEqual(2);
    expect(listBody.notifications[0]?.message).toBe('A hearing is scheduled in 2 days.');

    const read = await markRead(
      apiRequest(`/api/notifications/${first.notification_id}/read`, {
        method: 'POST',
        token: citizenToken,
        csrf: true,
      }),
      { params: Promise.resolve({ id: String(first.notification_id) }) },
    );
    expect(read.status).toBe(200);

    const afterRead = await createRepositories(getDb()).notifications.unreadCount(citizenId);
    expect(afterRead).toBeLessThan(listBody.unreadCount);

    const readAll = await markAllRead(
      apiRequest('/api/notifications/read-all', { method: 'POST', token: citizenToken, csrf: true }),
    );
    expect(readAll.status).toBe(200);
    expect((await readAll.json()) as { updated: number }).toMatchObject({ updated: expect.any(Number) });
    expect(await createRepositories(getDb()).notifications.unreadCount(citizenId)).toBe(0);
  });

  it('UT_INT_API_04 a citizen cannot mark another user’s notification as read', async () => {
    const lawyer = await createRepositories(getDb()).users.findByEmail('lawyer@lawtrack.demo');
    const foreign = await createRepositories(getDb()).notifications.create({
      userId: lawyer?.user_id ?? 0,
      message: 'New draft in the review queue.',
      channel: 'In-App',
      status: 'Unread',
      timestamp: '2026-11-10 14:00:00',
    });

    const attempt = await markRead(
      apiRequest(`/api/notifications/${foreign.notification_id}/read`, {
        method: 'POST',
        token: citizenToken,
        csrf: true,
      }),
      { params: Promise.resolve({ id: String(foreign.notification_id) }) },
    );
    expect(attempt.status).toBe(404);

    const stillUnread = await createRepositories(getDb()).notifications.unreadCount(lawyer?.user_id ?? 0);
    expect(stillUnread).toBeGreaterThanOrEqual(1);
  });
});
