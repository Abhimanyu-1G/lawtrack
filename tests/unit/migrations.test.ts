import { afterEach, describe, expect, it } from 'vitest';

import type { LawTrackDatabase } from '../../src/server/db/client';
import { createInMemoryDatabase } from '../../src/server/db/memory';
import {
  listAppliedMigrations,
  loadMigrationFiles,
  runMigrations,
} from '../../src/server/db/migrate';

const ER_TABLES = [
  'User',
  'Citizen',
  'Legal_Aid_Lawyer',
  'Content_Curator',
  'System_Administrator',
  'API_Integration_Manager',
  'Legal_Guide',
  'Chat_Session',
  'Chat_Message',
  'Legal_Draft',
  'Draft_Review',
  'Court_Case',
  'Hearing',
  'API_Integration',
  'Notification',
  'Audit_Log',
  'Case_Tracking',
  'Guide_View',
];

const HELPER_TABLES = ['Otp_Code', 'System_Setting', 'Metric_Event', 'Guide_Embedding'];

let handle: LawTrackDatabase | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function tableNames(db: LawTrackDatabase): string[] {
  const rows = db.sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

function insertUser(db: LawTrackDatabase, email: string, name = 'Ramesh Sharma'): void {
  db.sqlite
    .prepare(
      'INSERT INTO User (name, email, password_hash, role, language, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(name, email, '$2b$12$abcdefghijklmnopqrstuv', 'Citizen', 'English', 0);
}

describe('database migrations', () => {
  it('creates all 18 ER tables plus the 4 helper tables', () => {
    handle = createInMemoryDatabase();
    const names = tableNames(handle);

    for (const table of [...ER_TABLES, ...HELPER_TABLES]) {
      expect(names, `missing table ${table}`).toContain(table);
    }
  });

  it('enables foreign keys and tracks applied migrations', () => {
    handle = createInMemoryDatabase();

    expect(handle.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(listAppliedMigrations(handle)).toEqual(
      loadMigrationFiles().map((migration) => migration.name),
    );
  });

  it('applies twice without error and reports the second run as a no-op', () => {
    handle = createInMemoryDatabase();

    const second = runMigrations(handle);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(loadMigrationFiles().map((migration) => migration.name));
  });

  it('enforces case-insensitive unique emails', () => {
    handle = createInMemoryDatabase();
    insertUser(handle!, 'Ramesh@LawTrack.in');

    expect(() => insertUser(handle!, 'ramesh@lawtrack.in')).toThrow(/UNIQUE/i);
  });

  it('enforces enum and length CHECK constraints', () => {
    handle = createInMemoryDatabase();

    // Name shorter than 2 characters violates the length CHECK.
    expect(() => insertUser(handle!, 'short@lawtrack.in', 'R')).toThrow(/CHECK/i);

    // Role outside the allowed enum.
    expect(() =>
      handle!.sqlite
        .prepare('INSERT INTO User (name, email, password_hash, role, language) VALUES (?, ?, ?, ?, ?)')
        .run('Ramesh Sharma', 'judge@lawtrack.in', '$2b$12$abcdefghijklmnopqrstuv', 'Judge', 'English'),
    ).toThrow(/CHECK/i);
  });

  it('enforces the CNR format on Court_Case', () => {
    handle = createInMemoryDatabase();
    const now = '2026-11-10 06:30:00';

    insertUser(handle, 'manager@lawtrack.in');
    handle.sqlite
      .prepare('INSERT INTO API_Integration_Manager (user_id, managed_services) VALUES (1, ?)')
      .run('eCourts');
    handle.sqlite
      .prepare(
        'INSERT INTO API_Integration (integration_id, manager_id, service_name, status) VALUES (1, 1, ?, ?)',
      )
      .run('eCourts', 'Healthy');

    expect(() =>
      handle!.sqlite
        .prepare(
          'INSERT INTO Court_Case (integration_id, cnr_number, case_title, court_name, status, last_synced_at) VALUES (1, ?, ?, ?, ?, ?)',
        )
        .run('RJJP01001234202', 'Sharma vs State', 'District Court, Jaipur', 'Pending', now),
    ).toThrow(/CHECK/i);

    expect(() =>
      handle!.sqlite
        .prepare(
          'INSERT INTO Court_Case (integration_id, cnr_number, case_title, court_name, status, last_synced_at) VALUES (1, ?, ?, ?, ?, ?)',
        )
        .run('RJJP010012342022', 'Sharma vs State', 'District Court, Jaipur', 'Pending', now),
    ).not.toThrow();
  });

  it('rejects a draft version below 1', () => {
    handle = createInMemoryDatabase();
    insertUser(handle, 'draft-owner@lawtrack.in');
    handle.sqlite.prepare('INSERT INTO Citizen (user_id) VALUES (1)').run();

    expect(() =>
      handle!.sqlite
        .prepare(
          'INSERT INTO Legal_Draft (citizen_id, draft_type, form_data, generated_text, status, version, created_at) VALUES (1, ?, ?, ?, ?, ?, ?)',
        )
        .run('Complaint', '{"facts":"x"}', 'Generated text', 'Pending Review', 0, '2026-11-10 06:30:00'),
    ).toThrow(/CHECK/i);
  });
});
