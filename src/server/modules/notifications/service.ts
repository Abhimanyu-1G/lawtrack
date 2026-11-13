import 'server-only';

import type { NotificationChannel, NotificationStatus } from '../../../shared/enums';
import type { Repositories } from '../../db/repositories';
import type { Clock } from '../../lib/clock';
import { notFound } from '../../lib/errors';
import type { NotificationRow } from './repo';

/**
 * Notification centre (AGENTS.md §13). In-App rows are listed newest first,
 * opening one marks it `Delivered`, and the unread count drives the bell badge.
 */

export interface NotificationDto {
  id: number;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  caseId: number | null;
  timestamp: string;
}

export interface NotificationListDto {
  notifications: NotificationDto[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NotificationFilter {
  unreadOnly?: boolean;
  page?: string | number | null;
  pageSize?: string | number | null;
}

export interface NotificationsService {
  list(userId: number, filter?: NotificationFilter): Promise<NotificationListDto>;
  markRead(userId: number, notificationId: number): Promise<void>;
  markAllRead(userId: number): Promise<{ updated: number }>;
}

function toDto(row: NotificationRow): NotificationDto {
  return {
    id: row.notification_id,
    message: row.message,
    channel: row.channel,
    status: row.status,
    caseId: row.case_id,
    timestamp: row.timestamp,
  };
}

export function createNotificationsService(options: {
  repos: Repositories;
  clock: Clock;
}): NotificationsService {
  const { repos } = options;

  return {
    async list(userId, filter = {}) {
      const [result, unreadCount] = await Promise.all([
        repos.notifications.listForUser(userId, {
          unreadOnly: filter.unreadOnly,
          page: filter.page,
          pageSize: filter.pageSize,
        }),
        repos.notifications.unreadCount(userId),
      ]);

      return {
        notifications: result.items.map(toDto),
        total: result.total,
        unreadCount,
        page: result.page.page,
        pageSize: result.page.pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / result.page.pageSize)),
      };
    },

    async markRead(userId, notificationId) {
      const updated = await repos.notifications.markRead(userId, notificationId);
      if (!updated) throw notFound('Notification not found');
    },

    async markAllRead(userId) {
      const updated = await repos.notifications.markAllRead(userId);
      return { updated };
    },
  };
}
