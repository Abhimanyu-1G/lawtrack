import { afterEach, describe, expect, it } from 'vitest';

import type { LawTrackDatabase } from '../../src/server/db/client';
import { createInMemoryDatabase } from '../../src/server/db/memory';
import { createRepositories } from '../../src/server/db/repositories';
import { runSeed } from '../../src/server/db/seed';
import { DEMO_ACCOUNT_EMAILS } from '../../src/server/db/seed/users';
import { createFixedClock } from '../../src/server/lib/clock';
import { createGuidesService, type GuideService } from '../../src/server/modules/guides/service';
import type { Repositories } from '../../src/server/db/repositories';
import type { GuideRow } from '../../src/server/modules/guides/repo';

/**
 * Guide / curator business rules (Phase 3, AGENTS.md §6). Every test runs on an
 * in-memory database seeded with the real 35-guide corpus, using the fixed
 * Asia/Kolkata clock so audit timestamps and embedding refreshes are exact.
 */

const clock = createFixedClock('2026-11-10 12:00:00');
let handle: LawTrackDatabase | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

interface Fixture {
  handle: LawTrackDatabase;
  repos: Repositories;
  service: GuideService;
  curatorId: number;
  citizenId: number;
}

async function setup(): Promise<Fixture> {
  const database = createInMemoryDatabase();
  handle = database;
  await runSeed({ handle: database, clock, includeDemoAccounts: true });

  const repos = createRepositories(database);
  const curator = await repos.users.findByEmail(DEMO_ACCOUNT_EMAILS[2] ?? 'curator@lawtrack.demo');
  const citizen = await repos.users.findByEmail(DEMO_ACCOUNT_EMAILS[0] ?? 'citizen@lawtrack.demo');
  if (!curator || !citizen) throw new Error('demo accounts missing after seed');

  return {
    handle: database,
    repos,
    service: createGuidesService({ repos, clock }),
    curatorId: curator.user_id,
    citizenId: citizen.user_id,
  };
}

function mustFind<T>(value: T | undefined, message: string): T {
  if (!value) throw new Error(message);
  return value;
}

async function guideByTopic(
  repos: Repositories,
  topicKey: string,
  language: 'English' | 'Hindi',
): Promise<GuideRow> {
  const rows = await repos.guides.list({ language, status: 'Valid', pageSize: 50 });
  return mustFind(
    rows.items.find((row) => row.topic_key === topicKey),
    `missing ${language} guide for ${topicKey}`,
  );
}

describe('guides', () => {
  it('UT_GD_01 public listing and detail only expose Valid guides', async () => {
    const { repos, service } = await setup();

    const published = await service.listPublic({ language: 'English', pageSize: 50 });
    expect(published.total).toBe(15);
    expect(published.items.every((guide) => guide.status === 'Valid')).toBe(true);

    const draft = mustFind(
      (await repos.guides.list({ status: 'Draft', pageSize: 1 })).items[0],
      'seed is missing a Draft guide',
    );
    await expect(service.detailPublic(draft.guide_id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('UT_GD_02 a guide links to its exact counterpart in the other language', async () => {
    const { repos, service } = await setup();
    const english = await guideByTopic(repos, 'rti-application', 'English');
    const hindi = await guideByTopic(repos, 'rti-application', 'Hindi');

    const detail = await service.detailPublic(english.guide_id);
    expect(detail.alternate).toMatchObject({ id: hindi.guide_id, language: 'Hindi' });

    const hindiDetail = await service.detailPublic(hindi.guide_id);
    expect(hindiDetail.alternate).toMatchObject({ id: english.guide_id, language: 'English' });
  });

  it('UT_GD_03 a citizen view is recorded and becomes "continue reading"', async () => {
    const { handle: database, repos, service, citizenId } = await setup();
    const guide = await guideByTopic(repos, 'consumer-complaint', 'English');
    const session = { sub: String(citizenId), role: 'Citizen' as const };

    await service.detailPublic(guide.guide_id, session);

    const views = await database.db.selectFrom('Guide_View').selectAll().execute();
    expect(
      views.some((row) => row.citizen_id === citizenId && row.guide_id === guide.guide_id),
    ).toBe(true);

    const lastViewed = await service.lastViewed(citizenId);
    expect(lastViewed?.id).toBe(guide.guide_id);

    // Anonymous readers are not tracked.
    const anonymousGuide = await guideByTopic(repos, 'cyber-fraud', 'English');
    await service.detailPublic(anonymousGuide.guide_id);
    const afterAnonymous = await database.db.selectFrom('Guide_View').selectAll().execute();
    expect(afterAnonymous).toHaveLength(views.length);
  });

  it('UT_GD_04 a curator edit refreshes the embedding and writes an audit row', async () => {
    const { handle: database, repos, service, curatorId } = await setup();
    const guide = await guideByTopic(repos, 'labour-wages', 'English');

    const before = mustFind(
      await database.db
        .selectFrom('Guide_Embedding')
        .selectAll()
        .where('guide_id', '=', guide.guide_id)
        .executeTakeFirst(),
      'seed guide has no embedding',
    );

    const updated = await service.updateGuide(
      curatorId,
      guide.guide_id,
      { plain_summary: `${guide.plain_summary}\n\nA zebra tribunal illustration.` },
      'en',
    );
    expect(updated.summary).toContain('zebra tribunal');

    const after = mustFind(
      await database.db
        .selectFrom('Guide_Embedding')
        .selectAll()
        .where('guide_id', '=', guide.guide_id)
        .executeTakeFirst(),
      'embedding was not refreshed',
    );
    expect(after.vector).not.toBe(before.vector);
    expect(after.updated_at).toBe(clock.nowIso());

    const audit = await repos.audit.list({ action: 'GUIDE_EDITED' });
    expect(audit.total).toBe(1);
    expect(audit.items[0]?.performed_by).toBe(curatorId);
  });

  it('UT_GD_05 system-managed fields and short titles are rejected', async () => {
    const { repos, service, curatorId } = await setup();
    const guide = await guideByTopic(repos, 'property-sale-deed', 'English');

    await expect(
      service.updateGuide(curatorId, guide.guide_id, { validation_status: 'Valid' }, 'en'),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: [expect.objectContaining({ field: 'validation_status', code: 'FORMAT' })],
    });

    await expect(
      service.updateGuide(curatorId, guide.guide_id, { title: 'ab' }, 'en'),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: [expect.objectContaining({ field: 'title', code: 'LENGTH' })],
    });
  });

  it('UT_GD_06 validating a draft publishes it, counts it and writes an audit row', async () => {
    const { handle: database, repos, service, curatorId } = await setup();
    const draft = mustFind(
      (await repos.guides.list({ status: 'Draft', pageSize: 1 })).items[0],
      'seed is missing a Draft guide',
    );

    const before = mustFind(
      await database.db
        .selectFrom('Content_Curator')
        .select('validated_count')
        .where('user_id', '=', curatorId)
        .executeTakeFirst(),
      'curator row missing',
    );

    const validated = await service.validateGuide(curatorId, draft.guide_id, 'en');
    expect(validated.status).toBe('Valid');
    expect(validated.lastUpdated).toBe(clock.nowIso());

    const published = await service.detailPublic(draft.guide_id);
    expect(published.id).toBe(draft.guide_id);

    const after = mustFind(
      await database.db
        .selectFrom('Content_Curator')
        .select('validated_count')
        .where('user_id', '=', curatorId)
        .executeTakeFirst(),
      'curator row missing',
    );
    expect(after.validated_count).toBe(before.validated_count + 1);

    const embedding = await database.db
      .selectFrom('Guide_Embedding')
      .select('guide_id')
      .where('guide_id', '=', draft.guide_id)
      .executeTakeFirst();
    expect(embedding).toBeDefined();

    const audit = await repos.audit.list({ action: 'GUIDE_VALIDATED' });
    expect(audit.total).toBe(1);
    expect(audit.items[0]?.details).toContain(String(draft.guide_id));
  });

  it('UT_GD_07 flagging removes a guide from public view and drops its embedding', async () => {
    const { handle: database, repos, service, curatorId } = await setup();
    const guide = await guideByTopic(repos, 'property-inheritance', 'English');

    const flagged = await service.flagGuide(
      curatorId,
      guide.guide_id,
      { reason: 'State succession rules were amended.' },
      'en',
    );
    expect(flagged.status).toBe('Requires AI Update');

    await expect(service.detailPublic(guide.guide_id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const embedding = await database.db
      .selectFrom('Guide_Embedding')
      .select('guide_id')
      .where('guide_id', '=', guide.guide_id)
      .executeTakeFirst();
    expect(embedding).toBeUndefined();

    const audit = await repos.audit.list({ action: 'GUIDE_FLAGGED' });
    expect(audit.total).toBe(1);

    // Flagging is idempotent and does not write a second audit row.
    const again = await service.flagGuide(
      curatorId,
      guide.guide_id,
      { reason: 'Second attempt should be ignored.' },
      'en',
    );
    expect(again.status).toBe('Requires AI Update');
    expect((await repos.audit.list({ action: 'GUIDE_FLAGGED' })).total).toBe(1);
  });

  it('UT_GD_08 a draft cannot jump straight to Requires AI Update', async () => {
    const { repos, service, curatorId } = await setup();
    const draft = mustFind(
      (await repos.guides.list({ status: 'Draft', pageSize: 1 })).items[0],
      'seed is missing a Draft guide',
    );

    await expect(
      service.flagGuide(curatorId, draft.guide_id, { reason: 'Outdated statutory reference.' }, 'en'),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('UT_GD_09 re-simplify suggests text but never saves it', async () => {
    const { repos, service } = await setup();
    const guide = await guideByTopic(repos, 'bns-fir', 'English');

    const suggestion = await service.resimplifyGuide(guide.guide_id, 'en');
    expect(suggestion.demo).toBe(true);
    expect(suggestion.model).toBe('demo-simplify-v1');
    expect(suggestion.text.length).toBeGreaterThan(0);

    const stored = await repos.guides.findById(guide.guide_id);
    expect(stored?.plain_summary).toBe(guide.plain_summary);
  });

  it('UT_GD_10 re-validating a Valid guide is idempotent', async () => {
    const { handle: database, repos, service, curatorId } = await setup();
    const guide = await guideByTopic(repos, 'women-domestic-violence', 'English');

    const before = mustFind(
      await database.db
        .selectFrom('Content_Curator')
        .select('validated_count')
        .where('user_id', '=', curatorId)
        .executeTakeFirst(),
      'curator row missing',
    );

    const result = await service.validateGuide(curatorId, guide.guide_id, 'en');
    expect(result.status).toBe('Valid');

    const after = mustFind(
      await database.db
        .selectFrom('Content_Curator')
        .select('validated_count')
        .where('user_id', '=', curatorId)
        .executeTakeFirst(),
      'curator row missing',
    );
    expect(after.validated_count).toBe(before.validated_count);
    expect((await repos.audit.list({ action: 'GUIDE_VALIDATED' })).total).toBe(0);
  });

  it('UT_GD_11 status counts and category counts match the seeded corpus', async () => {
    const { service } = await setup();

    expect(await service.statusCounts()).toEqual({
      Draft: 3,
      Valid: 30,
      'Requires AI Update': 2,
    });

    const curatorList = await service.listForCurator({ pageSize: 50 });
    expect(curatorList.total).toBe(35);

    const categories = await service.categories('English');
    const total = categories.reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(15);
    expect(categories).toHaveLength(9);
  });
});
