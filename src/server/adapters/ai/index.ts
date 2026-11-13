import 'server-only';

import type { AppEnv } from '../../config/env';
import { getEnv } from '../../config/env';
import type { Repositories } from '../../db/repositories';
import type { Clock } from '../../lib/clock';
import { logger } from '../../lib/logger';
import { createGeminiProvider } from './gemini';
import { createMockAiProvider } from './mock';
import type { AiProvider } from './provider';

/**
 * Provider selection and health accounting (AGENTS.md §10).
 *
 * No key → MockProvider (offline, deterministic). With a key → GeminiProvider;
 * every call updates API_Integration id 2 so the API-manager console can show
 * Degraded/Down exactly like the other adapters.
 */

export interface CreateAiProviderOptions {
  env: AppEnv;
  repos?: Repositories;
  clock?: Clock;
  /** Administrator switch (`demo_ai_mode=off`), D-57. */
  forceMock?: boolean;
}

export function createAiProvider(options: CreateAiProviderOptions): AiProvider {
  const { env, repos, clock, forceMock } = options;
  if (forceMock || !env.GEMINI_API_KEY) return createMockAiProvider();

  const gemini = createGeminiProvider({
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    embeddingModel: env.GEMINI_EMBEDDING_MODEL,
  });

  if (!repos || !clock) return gemini;

  async function tracked<T>(operation: string, work: () => Promise<T>): Promise<T> {
    try {
      const result = await work();
      await repos!.integrations.recordSuccess(2, clock!.nowIso());
      return result;
    } catch (error) {
      const health = await repos!.integrations.recordFailure(2);
      logger.warn(
        { err: error, operation, integrationStatus: health.status, errorCount: health.errorCount },
        'Gemini call failed',
      );
      throw error;
    }
  }

  return {
    name: gemini.name,
    demo: gemini.demo,
    embed: (texts, embedOptions) => tracked('embed', () => gemini.embed(texts, embedOptions)),
    simplifyText: (text, language) =>
      tracked('simplifyText', () => gemini.simplifyText(text, language)),
    generateAnswer: (context) => tracked('generateAnswer', () => gemini.generateAnswer(context)),
    generateDraft: (context) => tracked('generateDraft', () => gemini.generateDraft(context)),
    regenerateDraft: (context) => tracked('regenerateDraft', () => gemini.regenerateDraft(context)),
  };
}

interface AiCache {
  provider?: AiProvider;
  forceMock?: boolean;
}

const globalForAi = globalThis as typeof globalThis & { __lawtrackAi?: AiCache };
const cache: AiCache = globalForAi.__lawtrackAi ?? (globalForAi.__lawtrackAi = {});

/** Process-wide provider, built lazily so the SDK client is created once. */
export function getAiProvider(repos?: Repositories, clock?: Clock): AiProvider {
  if (!cache.provider) {
    cache.provider = createAiProvider({ env: getEnv(), repos, clock, forceMock: cache.forceMock });
  }
  return cache.provider;
}

/**
 * Apply the administrator AI switch (`demo_ai_mode=off`) at runtime. Forcing
 * Mock AI drops the cached Gemini provider so the next call answers offline;
 * switching back rebuilds it lazily from the environment.
 */
export function setForceMockAi(forceMock: boolean): void {
  if (cache.forceMock === forceMock) return;
  cache.forceMock = forceMock;
  cache.provider = undefined;
  logger.info({ forceMock }, 'AI provider mode changed');
}

/** Read the current switch; used by the health job and tests. */
export function isForceMockAi(): boolean {
  return cache.forceMock === true;
}

/** Test hook: forget the provider after swapping env/database. */
export function resetAiProvider(): void {
  cache.provider = undefined;
  cache.forceMock = false;
}
