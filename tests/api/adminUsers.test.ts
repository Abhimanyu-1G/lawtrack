import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GET as listUsers, POST as createUser } from '../../src/app/api/admin/users/route';
import { PATCH as updateUser } from '../../src/app/api/admin/users/[id]/route';
import { GET as listCategories, PUT as replaceCategories } from '../../src/app/api/admin/categories/route';
import { closeDb, getDb } from '../../src/server/db/client';
import { createRepositories } from '../../src/server/db/repositories';
import { runSeed } from '../../src/server/db/seed';
import { createSessionToken } from '../../src/server/lib/tokens';
import { resetAdminServices } from '../../src/server/modules/admin';

/**
 * Administrator user-management flow (AGENTS.md §3, §7, §17): staff creation,
 * role changes with ER profile rows, validation errors, RBAC and audit rows.
 * Route handlers are invoked directly, exactly like the other API tests.
 */

const ORIGIN = 'http://localhost:3000';
const CSRF_TOKEN = 'api-admin-csrf-token';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
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

function userContext(id: number): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: String(id) }) };
}

let adminToken = '';
let adminId = 0;
let citizenToken = '';

async function tokenFor(email: string, role: 'Administrator' | 'Citizen'): Promise<{ id: number; token: string }> {
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
  resetAdminServices();

  const admin = await tokenFor('admin@lawtrack.demo', 'Administrator');
  const citizen = await tokenFor('citizen@lawtrack.demo', 'Citizen');
  adminToken = admin.token;
  adminId = admin.id;
  citizenToken = citizen.token;
});

afterAll(async () => {
  resetAdminServices();
  await closeDb();
});

describe('admin users API', () => {
  it('UT_ADM_API_01 only an administrator can list the user directory', async () => {
    const citizenAttempt = await listUsers(apiRequest('/api/admin/users', { token: citizenToken }));
    expect(citizenAttempt.status).toBe(403);

    const anonymous = await listUsers(apiRequest('/api/admin/users'));
    expect(anonymous.status).toBe(401);

    const response = await listUsers(
      apiRequest('/api/admin/users?role=Lawyer&pageSize=50', { token: adminToken }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { users: { role: string }[]; total: number };
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.users.every((user) => user.role === 'Lawyer')).toBe(true);
  });

  it('UT_ADM_API_02 creates a lawyer with a bar-council profile and an audit row', async () => {
    const response = await createUser(
      apiRequest('/api/admin/users', {
        method: 'POST',
        token: adminToken,
        csrf: true,
        body: {
          name: 'Neha Kulkarni',
          email: 'neha.kulkarni@lawtrack.test',
          phone_number: '+919867012345',
          password: 'Lawyer1234',
          role: 'Lawyer',
          language: 'English',
          bar_council_id: 'RJ/7788/2021',
          specialization: 'Tenancy and consumer disputes',
          experience_years: 5,
        },
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      user: { id: number; role: string; isVerified: boolean; phoneNumber: string | null };
    };
    expect(body.user.role).toBe('Lawyer');
    expect(body.user.isVerified).toBe(true);
    expect(body.user.phoneNumber).toBe('9867012345');

    const profile = await getDb()
      .db.selectFrom('Legal_Aid_Lawyer')
      .selectAll()
      .where('user_id', '=', body.user.id)
      .executeTakeFirst();
    expect(profile?.bar_council_id).toBe('RJ/7788/2021');

    const audit = await createRepositories(getDb()).audit.list({ action: 'USER_CREATED' });
    expect(audit.items.some((row) => row.performed_by === adminId)).toBe(true);
  });

  it('UT_ADM_API_03 rejects duplicate emails and a lawyer without a bar council id', async () => {
    const duplicate = await createUser(
      apiRequest('/api/admin/users', {
        method: 'POST',
        token: adminToken,
        csrf: true,
        body: {
          name: 'Duplicate Account',
          email: 'admin@lawtrack.demo',
          password: 'Admin1234',
          role: 'Citizen',
          language: 'English',
        },
      }),
    );
    expect(duplicate.status).toBe(422);
    const duplicateBody = (await duplicate.json()) as {
      error: { code: string; fields: { field: string; code: string }[] };
    };
    expect(duplicateBody.error.code).toBe('VALIDATION_FAILED');
    expect(duplicateBody.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email', code: 'UNIQUE' })]),
    );

    const missingBarCouncil = await createUser(
      apiRequest('/api/admin/users', {
        method: 'POST',
        token: adminToken,
        csrf: true,
        body: {
          name: 'Timothy Fernandes',
          email: 'timothy@lawtrack.test',
          password: 'Lawyer1234',
          role: 'Lawyer',
          language: 'English',
        },
      }),
    );
    expect(missingBarCouncil.status).toBe(422);
    const missingBody = (await missingBarCouncil.json()) as {
      error: { fields: { field: string; code: string }[] };
    };
    expect(missingBody.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'bar_council_id', code: 'REQUIRED' })]),
    );
  });

  it('UT_ADM_API_04 changes a role, inserts the profile row and refuses self-demotion', async () => {
    const created = await createUser(
      apiRequest('/api/admin/users', {
        method: 'POST',
        token: adminToken,
        csrf: true,
        body: {
          name: 'Priya Deshpande',
          email: 'priya.deshpande@lawtrack.test',
          password: 'Citizen1234',
          role: 'Citizen',
          language: 'Hindi',
        },
      }),
    );
    expect(created.status).toBe(201);
    const { user } = (await created.json()) as { user: { id: number; role: string } };

    const promoted = await updateUser(
      apiRequest(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        token: adminToken,
        csrf: true,
        body: { role: 'Lawyer', bar_council_id: 'RJ/9911/2022' },
      }),
      userContext(user.id),
    );
    expect(promoted.status).toBe(200);
    expect(await promoted.json()).toMatchObject({ user: { role: 'Lawyer' } });

    const profile = await getDb()
      .db.selectFrom('Legal_Aid_Lawyer')
      .select('bar_council_id')
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    expect(profile?.bar_council_id).toBe('RJ/9911/2022');

    const selfDemotion = await updateUser(
      apiRequest(`/api/admin/users/${adminId}`, {
        method: 'PATCH',
        token: adminToken,
        csrf: true,
        body: { role: 'Citizen' },
      }),
      userContext(adminId),
    );
    expect(selfDemotion.status).toBe(403);
    expect(await selfDemotion.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });

    const audit = await createRepositories(getDb()).audit.list({ action: 'USER_ROLE_CHANGED' });
    expect(audit.items.some((row) => row.performed_by === adminId)).toBe(true);
  });

  it('UT_ADM_API_05 lists, replaces and validates guide categories', async () => {
    const forbidden = await listCategories(apiRequest('/api/admin/categories', { token: citizenToken }));
    expect(forbidden.status).toBe(403);

    const before = await listCategories(apiRequest('/api/admin/categories', { token: adminToken }));
    expect(before.status).toBe(200);
    const beforeBody = (await before.json()) as {
      categories: { name: string; guideCount: number }[];
    };
    expect(beforeBody.categories.length).toBeGreaterThanOrEqual(9);
    expect(beforeBody.categories.some((entry) => entry.guideCount > 0)).toBe(true);

    const duplicate = await replaceCategories(
      apiRequest('/api/admin/categories', {
        method: 'PUT',
        token: adminToken,
        csrf: true,
        body: { categories: ['RTI', 'rti'] },
      }),
    );
    expect(duplicate.status).toBe(422);
    const duplicateBody = (await duplicate.json()) as {
      error: { fields: { field: string; code: string }[] };
    };
    expect(duplicateBody.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'category', code: 'UNIQUE' })]),
    );

    const replaced = await replaceCategories(
      apiRequest('/api/admin/categories', {
        method: 'PUT',
        token: adminToken,
        csrf: true,
        body: { categories: ['RTI', 'Consumer Rights', 'Cyber & Online Fraud'] },
      }),
    );
    expect(replaced.status).toBe(200);
    const replacedBody = (await replaced.json()) as { categories: { name: string }[] };
    expect(replacedBody.categories.map((entry) => entry.name).slice(0, 3)).toEqual([
      'RTI',
      'Consumer Rights',
      'Cyber & Online Fraud',
    ]);

    const audit = await createRepositories(getDb()).audit.list({ action: 'CATEGORIES_UPDATED' });
    expect(audit.items.some((row) => row.performed_by === adminId)).toBe(true);
  });
});
