import 'server-only';

import type { Kysely, Selectable } from 'kysely';

import type { NotificationChannel, NotificationStatus } from '../../../shared/enums';
import { normalisePagination, type PageParams } from '../../db/query';
import type { Database, NotificationTable } from '../../db/schema';

export type NotificationRow = Selectable<NotificationTable>;

export interface NewNotification {
  userId: number;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  caseId?: number | null;
  timestamp: string;
}

/**
 * In-app and mock email/SMS notifications (AGENTS.md §13). In-App rows start
 * `Unread`; opening one marks it `Delivered`. External channels start `Sent`
 * because the mock gateway accepts immediately.
 */
export function createNotificationsRepo(db: Kysely<Database>) {
  return {
    async create(input: NewNotification): Promise<NotificationRow> {
      return db
        .insertInto('Notification')
        .values({
          user_id: input.userId,
          case_id: input.caseId ?? null,
          message: input.message,
          channel: input.channel,
          status: input.status,
          timestamp: input.timestamp,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async listForUser(
      userId: number,
      filter: {
        unreadOnly?: boolean;
        page?: string | number | null;
        pageSize?: string | number | null;
      } = {},
    ): Promise<{ items: NotificationRow[]; total: number; page: PageParams }> {
      const page = normalisePagination(filter.page, filter.pageSize);

      let base = db.selectFrom('Notification').where('user_id', '=', userId);
      if (filter.unreadOnly) base = base.where('status', '=', 'Unread');

      const items = await base
        .selectAll()
        .orderBy('timestamp', 'desc')
        .orderBy('notification_id', 'desc')
        .limit(page.pageSize)
        .offset(page.offset)
        .execute();

      const countRow = await base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirst();

      return { items, total: Number(countRow?.total ?? 0), page };
    },

    async unreadCount(userId: number): Promise<number> {
      const row = await db
        .selectFrom('Notification')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .where('user_id', '=', userId)
        .where('status', '=', 'Unread')
        .executeTakeFirst();
      return Number(row?.total ?? 0);
    },

    async markRead(userId: number, notificationId: number): Promise<boolean> {
      const row = await db
        .updateTable('Notification')
        .set({ status: 'Delivered' })
        .where('notification_id', '=', notificationId)
        .where('user_id', '=', userId)
        .returning('notification_id')
        .executeTakeFirst();
      return row !== undefined;
    },

    async markAllRead(userId: number): Promise<number> {
      const rows = await db
        .updateTable('Notification')
        .set({ status: 'Delivered' })
        .where('user_id', '=', userId)
        .where('status', '=', 'Unread')
        .returning('notification_id')
        .execute();
      return rows.length;
    },
  };
}

export type NotificationsRepo = ReturnType<typeof createNotificationsRepo>;
