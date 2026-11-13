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
import { Stepper } from '../../components/ui/Stepper';
import { formatMessage, type Dictionary, type Locale } from '../../i18n';
import { ApiRequestError } from '../auth/api';
import { downloadDraftPdf, getDraft, regenerateDraft } from './api';
import {
  answerDisplay,
  draftStatusLabel,
  draftTypeName,
  formatDraftDateTime,
} from './format';
import { statusTone, type DraftDetail as DraftDetailData } from './types';

/**
 * Citizen draft detail (AGENTS.md §6, §9): a status stepper, the reviewer
 * remarks and timeline, and — only once approved — the generated text plus PDF
 * export. Unapproved text is never sent to the browser.
 */

function StatusBlock({ draft, dict, locale }: { draft: DraftDetailData; dict: Dictionary; locale: Locale }) {
  if (draft.status === 'Approved' && draft.approval) {
    return (
      <div className="rounded-input border border-success/30 bg-success-tint px-4 py-3 text-sm leading-6 text-success">
        <p className="font-semibold">{dict.drafts.approvedTitle}</p>
        <p className="mt-1">
          {formatMessage(dict.drafts.approvedBody, {
            name: draft.approval.lawyerName,
            date: formatDraftDateTime(draft.approval.approvedAt, locale),
          })}
        </p>
      </div>
    );
  }

  if (draft.status === 'Rejected') {
    const lastRejection = [...draft.timeline].reverse().find((entry) => entry.kind === 'rejected');
    return (
      <div className="rounded-input border border-danger/30 bg-danger-tint px-4 py-3 text-sm leading-6 text-danger">
        <p className="font-semibold">{dict.drafts.rejectedTitle}</p>
        <p className="mt-1">{dict.drafts.rejectedBody}</p>
        {lastRejection?.remarks ? (
          <p className="mt-2 rounded-input bg-surface/70 px-3 py-2 text-ink">
            <span className="font-semibold">{dict.drafts.lawyerRemarksTitle}: </span>
            {lastRejection.remarks}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-input border border-warning/30 bg-warning-tint px-4 py-3 text-sm leading-6 text-warning">
      <p className="font-semibold">{dict.drafts.pendingTitle}</p>
      <p className="mt-1">{dict.drafts.pendingBody}</p>
    </div>
  );
}

function DetailInner({ id, locale, dict }: { id: number; locale: Locale; dict: Dictionary }) {
  const queryClient = useQueryClient();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const draftQuery = useQuery({
    queryKey: ['draft', id],
    queryFn: () => getDraft(id, locale),
  });

  const regenerate = useMutation({
    mutationFn: () => regenerateDraft(id, locale),
    onSuccess: (draft) => {
      queryClient.setQueryData(['draft', id], draft);
    },
  });

  async function download(): Promise<void> {
    setPdfError(null);
    setDownloading(true);
    try {
      const blob = await downloadDraftPdf(id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lawtrack-draft-${id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError(dict.drafts.pdfFailed);
    } finally {
      setDownloading(false);
    }
  }

  if (draftQuery.isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (draftQuery.isError || !draftQuery.data) {
    return (
      <EmptyState
        title={dict.drafts.detailLoadError}
        body={dict.drafts.actionFailed}
        action={
          <Link href="/citizen/drafts" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            {dict.drafts.backToDrafts}
          </Link>
        }
      />
    );
  }

  const draft = draftQuery.data;
  const approved = draft.status === 'Approved';
  const steps = [
    { label: dict.drafts.stepAnswers, state: 'done' as const },
    {
      label: dict.drafts.stepStatus,
      state: approved ? ('done' as const) : ('current' as const),
    },
    {
      label: dict.drafts.statusApproved,
      state: approved ? ('current' as const) : ('upcoming' as const),
    },
  ];

  const answers = Object.entries(draft.answers).filter(([, value]) => value !== '' && value !== false);
  const labels = dict.drafts.fields as Record<string, string>;

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {dict.drafts.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{draftTypeName(dict, draft.type)}</h1>
          <p className="mt-2 text-sm text-muted">
            {formatMessage(dict.drafts.createdOn, {
              date: formatDraftDateTime(draft.createdAt, locale),
            })}
            {' · '}
            {formatMessage(dict.drafts.versionLabel, { version: draft.version })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={statusTone(draft.status)}>{draftStatusLabel(dict, draft.status)}</Badge>
          {draft.rejectionCount > 0 ? (
            <span className="text-xs text-muted">
              {formatMessage(dict.drafts.rejectionCount, { count: draft.rejectionCount })}
            </span>
          ) : null}
        </div>
      </div>

      <Link
        href="/citizen/drafts"
        className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        ← {dict.drafts.backToDrafts}
      </Link>

      <div className="mt-6">
        <Stepper steps={steps} label={dict.drafts.timelineTitle} />
      </div>

      <div className="mt-5 space-y-4">
        <StatusBlock draft={draft} dict={dict} locale={locale} />

        {regenerate.isError ? (
          <FormAlert>
            {regenerate.error instanceof ApiRequestError && regenerate.error.code === 'AI_UNAVAILABLE'
              ? dict.drafts.regenerationFailed
              : dict.drafts.actionFailed}
          </FormAlert>
        ) : null}
        {regenerate.isSuccess ? <FormAlert tone="success">{dict.drafts.regenerationQueued}</FormAlert> : null}
        {pdfError ? <FormAlert>{pdfError}</FormAlert> : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle as="h2" className="text-lg">
              {approved ? dict.drafts.generatedTextTitle : dict.drafts.answersSummary}
            </CardTitle>
            {approved ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/print/drafts/${draft.id}`}
                  target="_blank"
                  className="inline-flex h-9 items-center rounded-input border border-line px-3 text-sm font-semibold text-ink transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {dict.drafts.openPrintView}
                </Link>
                <Button size="sm" onClick={download} disabled={downloading}>
                  {downloading ? dict.drafts.downloading : dict.drafts.downloadPdf}
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardBody>
            {approved && draft.generatedText ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-ink">
                {draft.generatedText}
              </pre>
            ) : (
              <div>
                <p className="text-sm leading-6 text-muted">{dict.drafts.unapprovedHidden}</p>
                <dl className="mt-4 divide-y divide-line">
                  {answers.map(([name, value]) => (
                    <div key={name} className="grid gap-1 py-2.5 sm:grid-cols-3 sm:gap-4">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {labels[name] ?? name}
                      </dt>
                      <dd className="whitespace-pre-line text-sm leading-6 text-ink sm:col-span-2">
                        {answerDisplay(dict, name, value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {draft.status === 'Rejected' ? (
              <div className="mt-5 border-t border-line pt-4">
                <Button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
                  {regenerate.isPending ? dict.drafts.regenerating : dict.drafts.regenerate}
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-lg">
              {dict.drafts.timelineTitle}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ol className="space-y-4">
              {draft.timeline.map((entry, index) => {
                const label =
                  entry.kind === 'submitted'
                    ? dict.drafts.timelineSubmitted
                    : entry.kind === 'approved'
                      ? formatMessage(dict.drafts.timelineApproved, { name: entry.actorName ?? '' })
                      : entry.kind === 'rejected'
                        ? formatMessage(dict.drafts.timelineRejected, { name: entry.actorName ?? '' })
                        : formatMessage(dict.drafts.timelineRegenerated, {
                            version: entry.version ?? '',
                          });
                return (
                  <li key={`${entry.kind}-${entry.at}-${index}`} className="border-l-2 border-line pl-3">
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDraftDateTime(entry.at, locale)}
                    </p>
                    {entry.remarks ? (
                      <p className="mt-1.5 whitespace-pre-line text-xs leading-5 text-ink">
                        {entry.remarks}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted">{dict.common.footerDisclaimer}</p>
    </div>
  );
}

export function DraftDetail({ id, locale, dict }: { id: number; locale: Locale; dict: Dictionary }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <DetailInner id={id} locale={locale} dict={dict} />
    </QueryClientProvider>
  );
}
