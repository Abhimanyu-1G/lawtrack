import 'server-only';

import type { Kysely } from 'kysely';

import type { Database } from '../../db/schema';

/**
 * Key/value platform settings (System_Setting). Values are stored as text;
 * helpers decode numbers and JSON with safe fallbacks so a malformed admin
 * edit can never crash a request.
 *
 * Methods use closures rather than `this`, so a destructured
 * `const { getNumber } = repos.settings` keeps working.
 */
export function createSettingsRepo(db: Kysely<Database>) {
  const get = async (key: string): Promise<string | undefined> => {
    const row = await db
      .selectFrom('System_Setting')
      .select('value')
      .where('key', '=', key)
      .executeTakeFirst();
    return row?.value;
  };

  const set = async (key: string, value: string): Promise<void> => {
    await db
      .insertInto('System_Setting')
      .values({ key, value })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
      .execute();
  };

  return {
    get,
    set,

    async all(): Promise<Record<string, string>> {
      const rows = await db.selectFrom('System_Setting').selectAll().execute();
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    },

    async getNumber(key: string, fallback: number): Promise<number> {
      const parsed = Number(await get(key));
      return Number.isFinite(parsed) ? parsed : fallback;
    },

    async getJson<T>(key: string, fallback: T): Promise<T> {
      const raw = await get(key);
      if (raw === undefined) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },

    async setJson(key: string, value: unknown): Promise<void> {
      await set(key, JSON.stringify(value));
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
