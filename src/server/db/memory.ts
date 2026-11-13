import 'server-only';

import { createDatabase, type LawTrackDatabase } from './client';
import { runMigrations } from './migrate';

/**
 * In-memory database factory used by tests (and by throwaway scripts).
 *
 * A fresh `:memory:` database is created per call, so tests are isolated and
 * never touch the developer's `data/lawtrack.db`. Migrations are applied by
 * default so a test can immediately insert fixtures.
 */
export interface InMemoryDatabaseOptions {
  migrate?: boolean;
}

export function createInMemoryDatabase(options: InMemoryDatabaseOptions = {}): LawTrackDatabase {
  const handle = createDatabase({ path: ':memory:' });
  if (options.migrate !== false) runMigrations(handle);
  return handle;
}

/** Run a callback against a throwaway database and always close it. */
export async function withInMemoryDatabase<T>(
  callback: (handle: LawTrackDatabase) => Promise<T> | T,
  options: InMemoryDatabaseOptions = {},
): Promise<T> {
  const handle = createInMemoryDatabase(options);
  try {
    return await callback(handle);
  } finally {
    await handle.close();
  }
}
