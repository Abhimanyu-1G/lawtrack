import { afterEach, describe, expect, it } from 'vitest';

import type { LawTrackDatabase } from '../../src/server/db/client';
import { createInMemoryDatabase } from '../../src/server/db/memory';
import { runSeed } from '../../src/server/db/seed';
import { DEFAULT_SETTINGS } from '../../src/server/db/seed/settings';
import {
  DEMO_ACCOUNT_EMAILS,
  DEMO_PASSWORD,
  SYSTEM_INTEGRATIONS_EMAIL,
  SYSTEM_USER_EMAIL,
} from '../../src/server/db/seed/users';
import { createRepositories } from '../../src/server/db/repositories';
import { createFixedClock } from '../../src/server/lib/clock';

const clock = createFixedClock('2026-11-10 12:00:00');
let handle: LawTrackDatabase | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

describe('seed', () => {
  it('creates the system user, demo accounts, integrations, settings and the bilingual guide corpus', async () => {
    handle = createInMemoryDatabase();
    const repos = createRepositories(handle);

    const result = await runSeed({ handle, clock, includeDemoAccounts: true });

    expect(result.created.users).toEqual(
      expect.arrayContaining([
        'system',
        'system-integrations',
        'citizen',
        'lawyer',
        'curator',
        'admin',
        'api-manager',
      ]),
    );
    expect(result.created.integrations).toBe(4);
    expect(result.created.guides).toBe(35);
    expect(result.created.settings).toBe(Object.keys(DEFAULT_SETTINGS).length);

    const system = await repos.users.findByEmail(SYSTEM_USER_EMAIL);
    expect(system?.role).toBe('Administrator');
    expect(system?.is_verified).toBe(0);

    for (const email of DEMO_ACCOUNT_EMAILS) {
      const demo = await repos.users.findByEmail(email);
      expect(demo, `missing demo account ${email}`).toBeDefined();
      expect(demo?.is_verified).toBe(1);
      expect(demo?.password_hash).not.toBe(DEMO_PASSWORD);
      expect(demo?.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    }

    const integrations = await repos.integrations.list();
    expect(integrations.map((row) => [row.integration_id, row.service_name, row.status])).toEqual([
      [1, 'eCourts', 'Healthy'],
      [2, 'Gemini', 'Healthy'],
      [3, 'India Code', 'Healthy'],
      [4, 'OTP Gateway', 'Healthy'],
    ]);

    const integrationManager = await repos.users.findByEmail(SYSTEM_INTEGRATIONS_EMAIL);
    expect(integrations.every((row) => row.manager_id === integrationManager?.user_id)).toBe(true);

    const guides = await repos.guides.list({ status: 'Valid', pageSize: 50 });
    expect(guides.total).toBe(30);
    const languages = new Set(guides.items.map((guide) => guide.language));
    expect(languages).toEqual(new Set(['English', 'Hindi']));
    expect(guides.items.every((guide) => (guide.source_excerpt ?? '').length > 0)).toBe(true);

    // Exactly 15 topics, each with an English and a Hindi version.
    const topics = new Map<string, Set<string>>();
    for (const guide of guides.items) {
      expect(guide.topic_key).toBeTruthy();
      const key = guide.topic_key ?? '';
      const set = topics.get(key) ?? new Set<string>();
      set.add(guide.language);
      topics.set(key, set);
    }
    expect(topics.size).toBe(15);
    expect([...topics.values()].every((versions) => versions.size === 2)).toBe(true);

    // The curator console has work to do: 3 drafts and 2 flagged guides.
    expect((await repos.guides.list({ status: 'Draft', pageSize: 50 })).total).toBe(3);
    expect((await repos.guides.list({ status: 'Requires AI Update', pageSize: 50 })).total).toBe(2);

    // Every published guide has an offline lexical embedding ready for RAG.
    const embeddings = await handle.db
      .selectFrom('Guide_Embedding')
      .select('guide_id')
      .execute();
    expect(embeddings).toHaveLength(30);

    const settings = await repos.settings.all();
    expect(settings.otp_expiry_minutes).toBe('10');
    expect(JSON.parse(settings.guide_categories ?? '[]')).toContain('RTI');
  });

  it('is idempotent: a second run creates nothing', async () => {
    handle = createInMemoryDatabase();

    await runSeed({ handle, clock, includeDemoAccounts: true });
    const second = await runSeed({ handle, clock, includeDemoAccounts: true });

    expect(second.created.integrations).toBe(0);
    expect(second.created.guides).toBe(0);
    expect(second.created.settings).toBe(0);
    expect(second.created.users).toEqual([]);

    const repos = createRepositories(handle);
    const guides = await repos.guides.list({ pageSize: 50 });
    expect(guides.total).toBe(35);
    expect((await repos.integrations.list()).length).toBe(4);
  });

  it('writes one audit entry per seed run that changed data', async () => {
    handle = createInMemoryDatabase();

    await runSeed({ handle, clock, includeDemoAccounts: true });
    const repos = createRepositories(handle);
    const system = await repos.users.findByEmail(SYSTEM_USER_EMAIL);
    const first = await repos.audit.list();
    expect(first.total).toBe(1);
    expect(first.items[0]?.action).toBe('SEED_APPLIED');
    expect(first.items[0]?.performed_by).toBe(system?.user_id);

    await runSeed({ handle, clock, includeDemoAccounts: true });
    const afterNoop = await repos.audit.list();
    expect(afterNoop.total).toBe(1);
  });

  it('refuses demo accounts when they are disabled (production behaviour)', async () => {
    handle = createInMemoryDatabase();
    const result = await runSeed({ handle, clock, includeDemoAccounts: false });
    const repos = createRepositories(handle);

    expect(result.demoAccountsSeeded).toBe(false);
    for (const email of DEMO_ACCOUNT_EMAILS) {
      expect(await repos.users.findByEmail(email)).toBeUndefined();
    }

    // The system integration manager still owns the seeded integrations.
    const integrations = await repos.integrations.list();
    expect(integrations.length).toBe(4);
    expect(integrations[0]?.manager_id).toBeGreaterThan(0);
  });
});
