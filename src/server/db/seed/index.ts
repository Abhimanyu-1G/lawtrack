import 'server-only';

import { systemClock, type Clock } from '../../lib/clock';
import { embedGuide } from '../../lib/embeddings';
import type { LawTrackDatabase } from '../client';
import { createRepositories } from '../repositories';
import { seedCases } from './cases';
import { INITIAL_GUIDES } from './guides';
import { DEFAULT_SETTINGS } from './settings';
import { seedAccounts } from './users';

/**
 * Idempotent database seed (AGENTS.md §4).
 *
 * Safe to run on every `npm run setup`: every insert checks for an existing
 * natural key first. Curator edits to guides are never overwritten because
 * guide seeding uses insert-if-missing semantics.
 *
 * Demo accounts are skipped when NODE_ENV=production.
 */

export interface SeedOptions {
  handle: LawTrackDatabase;
  clock?: Clock;
  /** Override the production guard (tests only). */
  includeDemoAccounts?: boolean;
}

export interface SeedResult {
  created: {
    users: string[];
    integrations: number;
    guides: number;
    settings: number;
    cases: number;
    tracking: number;
  };
  skipped: {
    integrations: number;
    guides: number;
    settings: number;
    cases: number;
  };
  demoAccountsSeeded: boolean;
}

const INTEGRATIONS = [
  { id: 1, serviceName: 'eCourts' },
  { id: 2, serviceName: 'Gemini' },
  { id: 3, serviceName: 'India Code' },
  { id: 4, serviceName: 'OTP Gateway' },
] as const;

export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  const clock = options.clock ?? systemClock;
  const now = clock.nowIso();
  const includeDemoAccounts = options.includeDemoAccounts ?? process.env.NODE_ENV !== 'production';
  const repos = createRepositories(options.handle);

  const accounts = await seedAccounts(repos, { includeDemoAccounts });

  const result: SeedResult = {
    created: {
      users: accounts.createdLabels,
      integrations: 0,
      guides: 0,
      settings: 0,
      cases: 0,
      tracking: 0,
    },
    skipped: { integrations: 0, guides: 0, settings: 0, cases: 0 },
    demoAccountsSeeded: includeDemoAccounts,
  };

  // ---- settings --------------------------------------------------------
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await repos.settings.get(key);
    if (existing === undefined) {
      await repos.settings.set(key, value);
      result.created.settings += 1;
    } else {
      result.skipped.settings += 1;
    }
  }

  // ---- integrations (fixed ids 1–4) ------------------------------------
  for (const integration of INTEGRATIONS) {
    const existing = await repos.integrations.findById(integration.id);
    if (existing) {
      result.skipped.integrations += 1;
      continue;
    }

    await repos.integrations.insertSeed({
      integrationId: integration.id,
      managerId: accounts.systemApiManager.user_id,
      serviceName: integration.serviceName,
      status: 'Healthy',
      lastSyncTime: now,
    });
    result.created.integrations += 1;
  }

  // ---- guides (15 bilingual topics + curator work queue) ---------------
  for (const guide of INITIAL_GUIDES) {
    const published = guide.status === 'Valid';
    const { created, row } = await repos.guides.insertSeedGuide({
      curatorId: published ? (accounts.curator?.user_id ?? null) : null,
      title: guide.title,
      category: guide.category,
      plainSummary: guide.plainSummary,
      sourceStatute: guide.sourceStatute,
      language: guide.language,
      validationStatus: guide.status,
      lastUpdated: now,
      sourceExcerpt: guide.sourceExcerpt,
      topicKey: guide.topicKey,
    });

    if (created) result.created.guides += 1;
    else result.skipped.guides += 1;

    // Seed a lexical index row so offline RAG works before the first edit.
    if (published) {
      const embedding = embedGuide(guide);
      await repos.guides.upsertEmbedding({
        guideId: row.guide_id,
        model: embedding.model,
        vector: embedding.vector,
        at: now,
      });
    }
  }

  // Seed accounts start with a truthful validation count for this batch.
  if (accounts.curator) {
    const validated = await repos.guides.countValidByCurator(accounts.curator.user_id);
    await repos.guides.setCuratorValidatedCount(accounts.curator.user_id, validated);
  }

  // ---- mock court cases (New: Phase 6) --------------------------------
  const demoCitizen = includeDemoAccounts
    ? await repos.users.findByEmail('citizen@lawtrack.demo')
    : undefined;
  const cases = await seedCases(repos, {
    at: now,
    demoCitizenId: demoCitizen?.user_id ?? null,
  });
  result.created.cases = cases.created;
  result.created.tracking = cases.trackingCreated;
  result.skipped.cases = cases.skipped;

  // ---- audit trail -----------------------------------------------------
  const rowsCreated =
    result.created.settings +
    result.created.integrations +
    result.created.guides +
    result.created.users.length;

  if (rowsCreated > 0) {
    await repos.audit.record({
      performedBy: accounts.systemUser.user_id,
      action: 'SEED_APPLIED',
      details: result.created,
      timestamp: now,
    });
  }

  return result;
}
