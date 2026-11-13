'use client';

import Link from 'next/link';
import { useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormAlert } from '../../components/ui/FormAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { type Dictionary, type Locale } from '../../i18n';
import { getCase, refreshCase, setTracking } from './api';
import {
  caseStatusLabel,
  caseStatusTone,
  formatCaseDate,
  formatCaseSyncedAt,
  nextHearingLabel,
} from './format';
import type { CaseView } from './types';

/**
 * Case detail (AGENTS.md §6, §15): status, next hearing, a stale-data banner,
 * the hearing timeline with plain-language order summaries, the subscribe
 * toggle and an on-demand refresh. A failed refresh keeps the saved copy on
 * screen and explains why (D-52).
 */

function DetailInner({ id, locale, dict }: { id: number; locale: Locale; dict: Dictionary }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const caseQuery = useQuery({
    queryKey: ['case', id],
    queryFn: () => getCase(id, locale),
  });

  const refresh = useMutation({
    mutationFn: () => refreshCase(id, locale),
    onSuccess: (updated) => {
      queryClient.setQueryData(['case', id], updated);
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setNotice(
        updated.stale
          ? { tone: 'danger', text: dict.cases.refreshFailed }
          : { tone: 'success', text: dict.cases.refreshed },
      );
    },
    onError: () => {
      setNotice({ tone: 'danger', text: dict.cases.refreshFailed });
    },
  });

  const tracking = useMutation({
    mutationFn: (subscribed: boolean) => setTracking(id, subscribed, locale),
    onSuccess: (result) => {
      queryClient.setQueryData<CaseView>(['case', id], (current) =>
        current ? { ...current, subscribed: result.subscribed } : current,
      );
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setNotice({ tone: 'success', text: dict.cases.subscriptionSaved });
    },
    onError: () => {
      setNotice({ tone: 'danger', text: dict.cases.failedTitle });
    },
  });

  if (caseQuery.isLoading) {
    return (
      <div className="max-w-4xl space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (caseQuery.isError || !caseQuery.data) {
    return (
      <EmptyState
        title={dict.cases.failedTitle}
        body={dict.cases.unavailableBody}
        action={
          <Link
            href="/citizen/cases"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {dict.cases.backToCases}
          </Link>
        }
      />
    );
  }

  const detail = caseQuery.data;
  const hearingLabel = nextHearingLabel(dict, detail.nextHearingDate);

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {dict.cases.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{detail.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {dict.cases.cnrLabel}: <span className="font-medium text-ink">{detail.cnr}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={caseStatusTone(detail.status)}>{caseStatusLabel(dict, detail.status)}</Badge>
          {detail.stale ? <Badge tone="warning">{dict.cases.staleBanner}</Badge> : null}
        </div>
      </div>

      <Link
        href="/citizen/cases"
        className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        ← {dict.cases.backToCases}
      </Link>

      {notice ? (
        <div className="mt-5">
          <FormAlert tone={notice.tone}>{notice.text}</FormAlert>
        </div>
      ) : null}

      {detail.stale ? (
        <div className="mt-5 rounded-input border border-warning/30 bg-warning-tint px-4 py-3 text-sm leading-6 text-warning">
          <p className="font-semibold">{dict.cases.staleBanner}</p>
          <p className="mt-1">{dict.cases.staleBannerBody}</p>
        </div>
      ) : null}

      <Card className="mt-6">
        <CardBody>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {dict.cases.courtLabel}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-ink">{detail.courtName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {dict.cases.nextHearingLabel}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-ink">
                {detail.nextHearingDate ? (
                  <>
                    {formatCaseDate(detail.nextHearingDate, locale)}
                    {hearingLabel ? (
                      <span className="mt-1 block text-xs text-muted">{hearingLabel}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted">{dict.cases.noNextDate}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {dict.cases.lastUpdatedLabel}
              </dt>
              <dd className="mt-1 text-sm leading-6 text-ink">
                {formatCaseSyncedAt(detail.lastSyncedAt, locale)}
              </dd>
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => tracking.mutate(!detail.subscribed)}
                disabled={tracking.isPending}
              >
                {detail.subscribed ? dict.cases.unsubscribe : dict.cases.subscribe}
              </Button>
              <Button size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                {refresh.isPending ? dict.cases.refreshing : dict.cases.refresh}
              </Button>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            {dict.cases.hearingsTitle}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {detail.hearings.length === 0 ? (
            <p className="text-sm leading-6 text-muted">{dict.cases.hearingsEmpty}</p>
          ) : (
            <ol className="space-y-6">
              {detail.hearings.map((hearing) => (
                <li key={hearing.id} className="border-l-2 border-line pl-4">
                  <p className="text-sm font-semibold text-ink">
                    {formatCaseDate(hearing.date, locale)}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted">
                    {dict.cases.purposeLabel}: {hearing.purpose}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink">
                    {hearing.orderSummary ?? dict.cases.orderNone}
                  </p>
                  {hearing.orderUrl ? (
                    <a
                      href={hearing.orderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {dict.cases.orderPdf}
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      <p className="mt-6 text-xs leading-5 text-muted">{dict.common.footerDisclaimer}</p>
    </div>
  );
}

export function CaseDetail({
  id,
  locale,
  dict,
}: {
  id: number;
  locale: Locale;
  dict: Dictionary;
}) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <DetailInner id={id} locale={locale} dict={dict} />
    </QueryClientProvider>
  );
}
