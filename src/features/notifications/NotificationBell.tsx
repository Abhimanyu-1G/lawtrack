'use client';

import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Dictionary, Locale } from '../../i18n';
import { apiRequest } from '../auth/api';

/**
 * In-App notification bell (AGENTS.md §13, §15). The badge shows the unread
 * count, the panel lists newest first, and opening a row marks it Delivered.
 * A local QueryClient keeps the widget self-contained so the rest of the app
 * does not pay for a provider it does not use yet.
 */

interface NotificationItem {
  id: number;
  message: string;
  channel: string;
  status: 'Unread' | 'Delivered' | 'Sent' | 'Failed';
  caseId: number | null;
  timestamp: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
}

function formatWhen(value: string, locale: Locale): string {
  const date = new Date(`${value.trim().replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5 1.5 5h-15S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

function NotificationBellInner({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiRequest<NotificationsResponse>('/api/notifications?pageSize=8', {
        method: 'GET',
        locale,
      }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: (id: number) =>
      apiRequest<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'POST', locale }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      apiRequest<{ updated: number }>('/api/notifications/read-all', { method: 'POST', locale }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const unread = query.data?.unreadCount ?? 0;
  const items = query.data?.notifications ?? [];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={dict.notifications.openLabel}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-pill text-ink transition-colors hover:bg-primary-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <BellIcon />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1 text-[11px] font-semibold leading-none text-primary-foreground"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
        <span className="sr-only">
          {dict.notifications.bellLabel}
          {unread > 0 ? ` — ${dict.notifications.unreadCount.replace('{{count}}', String(unread))}` : ''}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={dict.notifications.title}
          className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-card border border-line bg-surface shadow-soft"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="font-serif text-lg text-ink">{dict.notifications.title}</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="rounded-input px-2 py-1 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
              >
                {dict.notifications.markAllRead}
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {query.isPending ? (
              <p className="px-4 py-6 text-sm text-muted">{dict.common.loading}</p>
            ) : query.isError ? (
              <p role="alert" className="px-4 py-6 text-sm font-medium text-danger">
                {dict.notifications.loadError}
              </p>
            ) : items.length === 0 ? (
              <div className="px-4 py-6">
                <p className="text-sm font-medium text-ink">{dict.notifications.emptyTitle}</p>
                <p className="mt-1 text-sm text-muted">{dict.notifications.emptyBody}</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill ${
                          item.status === 'Unread' ? 'bg-primary' : 'bg-line'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6 text-ink">{item.message}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <time dateTime={item.timestamp} className="text-xs text-muted">
                            {formatWhen(item.timestamp, locale)}
                          </time>
                          {item.status === 'Unread' ? (
                            <button
                              type="button"
                              onClick={() => markRead.mutate(item.id)}
                              disabled={markRead.isPending}
                              className="rounded-input px-1.5 py-0.5 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
                            >
                              {dict.notifications.markRead}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationBell({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 0, staleTime: 30_000 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationBellInner locale={locale} dict={dict} />
    </QueryClientProvider>
  );
}
