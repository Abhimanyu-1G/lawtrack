import 'server-only';

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { LawTrackDatabase } from './client';

/**
 * Minimal, dependency-free SQL migration runner.
 *
 * SQL files live in `src/server/db/migrations` and are applied in filename
 * order exactly once; the ledger is the `_Migrations` table. Applying twice is
 * therefore a no-op (AGENTS.md §4 acceptance criteria), and the SQL itself also
 * uses `IF NOT EXISTS` so a partially-applied file is recoverable.
 */

export const DEFAULT_MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'server', 'db', 'migrations');

export interface MigrationFile {
  name: string;
  sql: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export class MigrationError extends Error {
  readonly file: string;

  constructor(file: string, cause: unknown) {
    super(`Migration "${file}" failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'MigrationError';
    this.file = file;
    this.cause = cause;
  }
}

export function loadMigrationFiles(directory: string = DEFAULT_MIGRATIONS_DIR): MigrationFile[] {
  const files = readdirSync(/* turbopackIgnore: true */ directory)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  return files.map((name) => ({
    name,
    sql: readFileSync(path.join(/* turbopackIgnore: true */ directory, name), 'utf8'),
  }));
}

function ensureLedger(target: LawTrackDatabase): void {
  target.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _Migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function appliedMigrations(target: LawTrackDatabase): Set<string> {
  const rows = target.sqlite.prepare('SELECT name FROM _Migrations').all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

/**
 * Apply every pending migration. Synchronous on purpose: better-sqlite3 is
 * synchronous and the whole operation is fast enough to run at boot.
 */
export function runMigrations(
  target: LawTrackDatabase,
  options: { directory?: string } = {},
): MigrationResult {
  ensureLedger(target);
  const alreadyApplied = appliedMigrations(target);
  const result: MigrationResult = { applied: [], skipped: [] };

  const record = target.sqlite.prepare(
    "INSERT INTO _Migrations (name, applied_at) VALUES (?, strftime('%Y-%m-%d %H:%M:%S', 'now'))",
  );

  for (const migration of loadMigrationFiles(options.directory)) {
    if (alreadyApplied.has(migration.name)) {
      result.skipped.push(migration.name);
      continue;
    }

    const apply = target.sqlite.transaction(() => {
      try {
        target.sqlite.exec(migration.sql);
        record.run(migration.name);
      } catch (error) {
        throw new MigrationError(migration.name, error);
      }
    });

    apply();
    result.applied.push(migration.name);
  }

  return result;
}

export function listAppliedMigrations(target: LawTrackDatabase): string[] {
  ensureLedger(target);
  const rows = target.sqlite.prepare('SELECT name FROM _Migrations ORDER BY name').all() as {
    name: string;
  }[];
  return rows.map((row) => row.name);
}
