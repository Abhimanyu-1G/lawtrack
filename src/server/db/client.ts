import 'server-only';

import { mkdirSync } from 'node:fs';
import path from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { getEnv } from '../config/env';
import { runMigrations } from './migrate';
import type { Database } from './schema';

export type SqliteDatabase = InstanceType<typeof BetterSqlite3>;

export interface LawTrackDatabase {
  /** Typed query builder — the only way services talk to SQLite. */
  db: Kysely<Database>;
  /** Raw handle for pragmas, migrations and health checks. */
  sqlite: SqliteDatabase;
  path: string;
  close(): Promise<void>;
}

export interface CreateDatabaseOptions {
  /** File path, or ':memory:' for tests. */
  path: string;
  /** Emit every statement to stdout — debugging only. */
  verbose?: boolean;
}

/**
 * Open a SQLite database with the pragmas LawTrack relies on:
 * foreign keys ON (data integrity), WAL for concurrent readers, a busy timeout
 * so background jobs and requests do not fail on a momentary write lock.
 *
 * Always runs on the Node.js runtime — never Edge (AGENTS.md §0).
 */
export function createDatabase({ path: dbPath, verbose = false }: CreateDatabaseOptions): LawTrackDatabase {
  if (dbPath !== ':memory:') {
    const directory = path.dirname(path.resolve(dbPath));
    mkdirSync(directory, { recursive: true });
  }

  const sqlite = new BetterSqlite3(dbPath, verbose ? { verbose: console.error } : {});
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  if (dbPath !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = NORMAL');
  }

  const db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqlite }),
  });

  return {
    db,
    sqlite,
    path: dbPath,
    close: async () => {
      await db.destroy();
    },
  };
}

interface DatabaseCache {
  handle?: LawTrackDatabase;
}

const globalForDb = globalThis as typeof globalThis & { __lawtrackDb?: DatabaseCache };
const cache: DatabaseCache = globalForDb.__lawtrackDb ?? (globalForDb.__lawtrackDb = {});

/**
 * Process-wide database handle. Next.js dev hot-reload re-evaluates modules,
 * so the handle is cached on `globalThis` to avoid opening a new connection on
 * every reload. Migrations are applied lazily so a fresh checkout that skipped
 * `npm run setup` still boots (idempotent, cheap).
 */
export function getDb(): LawTrackDatabase {
  if (!cache.handle) {
    const env = getEnv();
    const handle = createDatabase({ path: env.DB_PATH });
    runMigrations(handle);
    cache.handle = handle;
  }
  return cache.handle;
}

/** Test helper / graceful shutdown. */
export async function closeDb(): Promise<void> {
  if (cache.handle) {
    await cache.handle.close();
    cache.handle = undefined;
  }
}
