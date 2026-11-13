import 'server-only';

import { getAiProvider } from '../../adapters/ai';
import { getDb } from '../../db/client';
import { createRepositories } from '../../db/repositories';
import { systemClock } from '../../lib/clock';
import { createChatService, type ChatService } from './service';

/** Process-wide chat service, cached across Next.js dev hot reloads. */
interface ChatCache {
  service?: ChatService;
}

const globalForChat = globalThis as typeof globalThis & { __lawtrackChat?: ChatCache };
const cache: ChatCache = globalForChat.__lawtrackChat ?? (globalForChat.__lawtrackChat = {});

export function getChatService(): ChatService {
  if (!cache.service) {
    const repos = createRepositories(getDb());
    cache.service = createChatService({
      repos,
      clock: systemClock,
      ai: getAiProvider(repos, systemClock),
    });
  }
  return cache.service;
}

/** Test hook: forget the cached service (used after swapping the database). */
export function resetChatService(): void {
  cache.service = undefined;
}
