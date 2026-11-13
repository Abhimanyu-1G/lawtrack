'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormAlert } from '../../components/ui/FormAlert';
import { Skeleton } from '../../components/ui/Skeleton';
import { TextField } from '../../components/ui/TextField';
import { formatMessage, type Dictionary, type Locale } from '../../i18n';
import { ApiRequestError } from '../auth/api';
import { listCases, lookupCase } from './api';
import {
  caseStatusLabel,
  caseStatusTone,
  formatCaseDate,
  nextHearingLabel,
  normaliseCnrInput,
} from './format';
import type { CaseView } from './types';

/**
 * Citizen case tracker (AGENTS.md §6, §15): CNR mask with a live format hint,
 * lookup that auto-subscribes, and the tracked-case list. A malformed CNR is
 * caught in the browser and again by the API; the adapter is never called.
 */
function TrackerInner({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cnr, setCnr] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const casesQuery = useQuery({
    queryKey: ['cases'],
    queryFn: () => listCases(locale),
  });

  const lookup = useMutation({
    mutationFn: (value: string) => lookupCase(value, locale),
    onSuccess: (result) => {
      setFormError(null);
      setFieldError(null);
      void queryClient.invalidateQueries({ queryKey: ['cases'] });
      router.push(`/citizen/cases/${result.case.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        if (error.code === 'VALIDATION_FAILED') {
          setFieldError(error.fields[0]?.message ?? dict.cases.invalidCnr);
          setFormError(dict.cases.failedTitle);
          return;
        }
        if (error.code === 'NOT_FOUND') {
          setFormError(dict.cases.notFoundBody);
          return;
        }
        setFormError(dict.cases.unavailableBody);
        return;
      }
      setFormError(dict.cases.failedTitle);
    },
  });

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = normaliseCnrInput(cnr);
    if (value.length !== 16) {
      setFieldError(dict.cases.invalidCnr);
      return;
    }
    setFieldError(null);
    lookup.mutate(value);
  }

  const tracked = casesQuery.data ?? [];

  return (
    <div className="max-w-4xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {dict.cases.eyebrow}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{dict.cases.title}</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">{dict.cases.intro}</p>

      <Card className="mt-6">
        <CardBody>
          <form onSubmit={submit} noValidate>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <TextField
                  id="cnr"
                  label={dict.cases.lookupLabel}
                  hint={
                    fieldError
                      ? undefined
                      : `${dict.cases.lookupHint} · ${formatMessage(dict.cases.formatHint, {
                          count: cnr.length,
                        })}`
                  }
                  error={fieldError ?? undefined}
                  value={cnr}
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={16}
                  placeholder={dict.cases.lookupPlaceholder}
                  onChange={(event) => {
                    setCnr(normaliseCnrInput(event.target.value));
                    setFieldError(null);
                  }}
                />
              </div>
              <Button type="submit" disabled={lookup.isPending} className="sm:mb-0">
                {lookup.isPending ? dict.cases.lookupLoading : dict.cases.lookupAction}
              </Button>
            </div>
            {formError ? (
              <div className="mt-4">
                <FormAlert>{formError}</FormAlert>
              </div>
            ) : null}
          </form>
        </CardBody>
      </Card>

      <h2 className="mt-8 text-lg">{dict.cases.trackedTitle}</h2>

      {casesQuery.isLoading ? (
        <div className="mt-3 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : casesQuery.isError ? (
        <div className="mt-3">
          <FormAlert>{dict.cases.failedTitle}</FormAlert>
        </div>
      ) : tracked.length === 0 ? (
        <div className="mt-3">
          <EmptyState title={dict.cases.trackedEmptyTitle} body={dict.cases.trackedEmptyBody} />
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {tracked.map((row: CaseView) => {
            const label = nextHearingLabel(dict, row.nextHearingDate);
            return (
              <li key={row.id}>
                <Link
                  href={`/citizen/cases/${row.id}`}
                  className="block rounded-card border border-line bg-surface p-5 shadow-soft transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-serif text-lg text-ink">{row.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {row.cnr} · {row.courtName}
                      </p>
                      <p className="mt-2 text-sm text-ink">
                        {row.nextHearingDate
                          ? `${dict.cases.nextHearingLabel}: ${formatCaseDate(
                              row.nextHearingDate,
                              locale,
                            )}`
                          : dict.cases.noNextDate}
                        {label && row.nextHearingDate ? (
                          <span className="ml-2 text-xs text-muted">({label})</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge tone={caseStatusTone(row.status)}>
                        {caseStatusLabel(dict, row.status)}
                      </Badge>
                      {row.stale ? <Badge tone="warning">{dict.cases.staleBanner}</Badge> : null}
                    </div>
                  </div>
                  <span className="mt-3 inline-flex text-sm font-semibold text-primary">
                    {dict.cases.openCase} →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-xs leading-5 text-muted">{dict.common.footerDisclaimer}</p>
    </div>
  );
}

export function CaseTracker({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <TrackerInner locale={locale} dict={dict} />
    </QueryClientProvider>
  );
}
