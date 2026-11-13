'use client';

import Link from 'next/link';
import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormAlert } from '../../components/ui/FormAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';
import { formatMessage, type Dictionary, type Locale } from '../../i18n';
import { getQueue } from './api';
import { draftTypeName, formatDraftDate, formatDraftDateTime } from './format';
import type { ReviewQueueItem } from './types';

/** Shared lawyer review queue (AGENTS.md §6, §15): oldest first, SLA visible. */
function QueueInner({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const queueQuery = useQuery({
    queryKey: ['lawyer-queue'],
    queryFn: () => getQueue(locale),
    refetchInterval: 60_000,
  });

  if (queueQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (queueQuery.isError) {
    return <FormAlert>{dict.drafts.queueLoadError}</FormAlert>;
  }

  const queue = queueQuery.data ?? [];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {dict.drafts.eyebrow}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{dict.drafts.queueTitle}</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">{dict.drafts.queueIntro}</p>

      {queue.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={dict.drafts.queueEmptyTitle} body={dict.drafts.queueEmptyBody} />
        </div>
      ) : (
        <div className="mt-6">
          <Table caption={dict.drafts.queueTitle}>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{dict.drafts.eyebrow}</TableHeaderCell>
                <TableHeaderCell>{dict.drafts.queueCitizen}</TableHeaderCell>
                <TableHeaderCell>{dict.drafts.queueWaiting}</TableHeaderCell>
                <TableHeaderCell>{dict.drafts.queueDue}</TableHeaderCell>
                <TableHeaderCell>{dict.drafts.statusLabel}</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">{dict.drafts.queueOpen}</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {queue.map((item: ReviewQueueItem) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-semibold text-ink">{draftTypeName(dict, item.type)}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatMessage(dict.drafts.versionLabel, { version: item.version })}
                      {item.reviewCount > 0
                        ? ` · ${formatMessage(dict.drafts.queueReviews, { count: item.reviewCount })}`
                        : ''}
                    </p>
                  </TableCell>
                  <TableCell>{item.citizenName}</TableCell>
                  <TableCell>{formatMessage(dict.drafts.queueAge, { hours: item.ageHours })}</TableCell>
                  <TableCell>
                    <p>{formatDraftDate(item.slaDueAt, locale)}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDraftDateTime(item.createdAt, locale)}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1.5">
                      {item.overdue ? <Badge tone="danger">{dict.drafts.queueOverdue}</Badge> : null}
                      {item.claimedBy ? (
                        <Badge tone="warning">
                          {formatMessage(dict.drafts.queueClaimed, { name: item.claimedBy })}
                        </Badge>
                      ) : (
                        <Badge tone="success">{dict.drafts.statusPending}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/lawyer/drafts/${item.id}`}
                      className={buttonClasses('secondary', 'sm')}
                    >
                      {dict.drafts.queueOpen}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-6 text-xs leading-5 text-muted">{dict.drafts.claimNote}</p>
    </div>
  );
}

export function ReviewQueue({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <QueueInner locale={locale} dict={dict} />
    </QueryClientProvider>
  );
}
