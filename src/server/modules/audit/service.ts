import 'server-only';

import type { Repositories } from '../../db/repositories';
import type { AuditFilter } from './repo';

/**
 * Audit-log viewer (AGENTS.md §3, §7, §15).
 *
 * The repository already filters and paginates; this service adds the actor
 * identity to each row, the dropdown of action names, and the CSV export the
 * administrator downloads. Details stay as the stored JSON string — the table
 * renders it as compact key/value text, and no PII is added here.
 */

export interface AuditEntryDto {
  id: number;
  actorId: number;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  details: string | null;
  timestamp: string;
}

export interface AuditPageDto {
  items: AuditEntryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditService {
  list(filter: AuditFilter): Promise<AuditPageDto>;
  actions(): Promise<string[]>;
  toCsv(filter: AuditFilter): Promise<string>;
}

const CSV_COLUMNS = ['timestamp', 'actor_name', 'actor_email', 'actor_role', 'action', 'details'] as const;

function csvCell(value: string | null): string {
  const text = value ?? '';
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createAuditService(options: { repos: Repositories }): AuditService {
  const { repos } = options;

  function toDto(
    row: Awaited<ReturnType<Repositories['audit']['listWithActor']>>['items'][number],
  ): AuditEntryDto {
    return {
      id: row.log_id,
      actorId: row.performed_by,
      actorName: row.actor_name,
      actorEmail: row.actor_email,
      actorRole: row.actor_role,
      action: row.action,
      details: row.details ?? null,
      timestamp: row.timestamp,
    };
  }

  return {
    async list(filter) {
      const result = await repos.audit.listWithActor(filter);
      return {
        items: result.items.map(toDto),
        total: result.total,
        page: result.page.page,
        pageSize: result.page.pageSize,
      };
    },

    async actions() {
      return repos.audit.distinctActions();
    },

    async toCsv(filter) {
      const result = await repos.audit.listWithActor({ ...filter, limit: null });
      const lines = [CSV_COLUMNS.join(',')];
      for (const row of result.items) {
        lines.push(
          [
            csvCell(row.timestamp),
            csvCell(row.actor_name),
            csvCell(row.actor_email),
            csvCell(row.actor_role),
            csvCell(row.action),
            csvCell(row.details ?? null),
          ].join(','),
        );
      }
      // A trailing newline keeps spreadsheets and `wc -l` happy.
      return `${lines.join('\r\n')}\r\n`;
    },
  };
}
