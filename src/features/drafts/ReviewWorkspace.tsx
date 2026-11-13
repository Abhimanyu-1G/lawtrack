'use client';

import Link from 'next/link';
import { useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormAlert } from '../../components/ui/FormAlert';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { formatMessage, type Dictionary, type Locale } from '../../i18n';
import { DRAFT_REMARKS_MIN, charCount } from '../../shared/validation';
import { ApiRequestError } from '../auth/api';
import { approveDraft, getReview, rejectDraft } from './api';
import { answerDisplay, draftTypeName, formatDraftDateTime } from './format';

/**
 * Split draft review (AGENTS.md §6, §9): citizen answers on the left, generated
 * text on the right, earlier remarks below. Approve is terminal; reject needs
 * remarks and returns the draft to the citizen as a regenerated version.
 */
function ReviewInner({ id, locale, dict }: { id: number; locale: Locale; dict: Dictionary }) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [remarksError, setRemarksError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const reviewQuery = useQuery({
    queryKey: ['lawyer-review', id],
    queryFn: () => getReview(id, locale),
  });

  const approve = useMutation({
    mutationFn: () => approveDraft(id, locale),
    onSuccess: () => {
      setApproveOpen(false);
      setSuccess(dict.drafts.approveSuccess);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['lawyer-review', id] });
    },
    onError: (error) => {
      setApproveOpen(false);
      setActionError(
        error instanceof ApiRequestError && error.code === 'CONFLICT'
          ? dict.drafts.reviewConflict
          : dict.drafts.reviewFailed,
      );
    },
  });

  const reject = useMutation({
    mutationFn: () => rejectDraft(id, remarks.trim(), locale),
    onSuccess: (result) => {
      setRejectOpen(false);
      setSuccess(result.regenerationFailed ? dict.drafts.rejectSuccessNoAi : dict.drafts.rejectSuccess);
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['lawyer-review', id] });
      void queryClient.invalidateQueries({ queryKey: ['lawyer-queue'] });
    },
    onError: (error) => {
      setRejectOpen(false);
      if (error instanceof ApiRequestError && error.code === 'VALIDATION_FAILED') {
        setRemarksError(error.fields[0]?.message ?? dict.drafts.reviewFailed);
        return;
      }
      setActionError(
        error instanceof ApiRequestError && error.code === 'CONFLICT'
          ? dict.drafts.reviewConflict
          : dict.drafts.reviewFailed,
      );
    },
  });

  if (reviewQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return (
      <EmptyState
        title={dict.drafts.reviewLoadError}
        body={dict.drafts.actionFailed}
        action={
          <Link href="/lawyer/queue" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            {dict.drafts.queueTitle}
          </Link>
        }
      />
    );
  }

  const review = reviewQuery.data;
  const labels = dict.drafts.fields as Record<string, string>;
  const answers = Object.entries(review.answers).filter(
    ([, value]) => value !== '' && value !== false,
  );
  const decided = review.status !== 'Pending Review';
  const blocked = Boolean(review.claimedBy && !review.claimedByMe);
  const canDecide = !decided && !blocked && success === null;

  function submitReject(): void {
    if (charCount(remarks.trim()) < DRAFT_REMARKS_MIN) {
      setRemarksError(dict.drafts.remarksPlaceholder);
      return;
    }
    setRemarksError(null);
    reject.mutate();
  }

  return (
    <div className="max-w-5xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {dict.drafts.eyebrow}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{dict.drafts.reviewTitle}</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">{dict.drafts.reviewIntro}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge tone="primary">{draftTypeName(dict, review.type)}</Badge>
        <Badge tone="neutral">
          {formatMessage(dict.drafts.versionLabel, { version: review.version })}
        </Badge>
        <span className="text-sm text-muted">
          {dict.drafts.queueCitizen}: <span className="font-medium text-ink">{review.citizenName}</span>
        </span>
        <span className="text-sm text-muted">{formatDraftDateTime(review.createdAt, locale)}</span>
      </div>

      <Link
        href="/lawyer/queue"
        className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        ← {dict.drafts.queueTitle}
      </Link>

      <div className="mt-5 space-y-3">
        {blocked ? (
          <FormAlert>
            {formatMessage(dict.drafts.queueClaimed, { name: review.claimedBy ?? '' })}
          </FormAlert>
        ) : null}
        {actionError ? <FormAlert>{actionError}</FormAlert> : null}
        {success ? <FormAlert tone="success">{success}</FormAlert> : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-lg">
              {dict.drafts.answersTitle}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="divide-y divide-line">
              {answers.map(([name, value]) => (
                <div key={name} className="py-2.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {labels[name] ?? name}
                  </dt>
                  <dd className="mt-1 whitespace-pre-line text-sm leading-6 text-ink">
                    {answerDisplay(dict, name, value)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="text-lg">
              {dict.drafts.generatedTextTitle}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-7 text-ink">
              {review.generatedText}
            </pre>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            {dict.drafts.reviewHistoryTitle}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {review.reviews.length === 0 ? (
            <p className="text-sm text-muted">{dict.drafts.reviewHistoryEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {review.reviews.map((entry, index) => (
                <li key={`${entry.reviewedAt}-${index}`} className="border-l-2 border-line pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={entry.decision === 'Approved' ? 'success' : 'warning'}>
                      {entry.decision === 'Approved'
                        ? dict.drafts.statusApproved
                        : dict.drafts.statusRejected}
                    </Badge>
                    <span className="text-sm font-medium text-ink">{entry.lawyerName}</span>
                    <span className="text-xs text-muted">
                      {formatDraftDateTime(entry.reviewedAt, locale)}
                    </span>
                  </div>
                  {entry.remarks ? (
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-ink">
                      {entry.remarks}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle as="h2" className="text-lg">
            {dict.drafts.remarksTitle}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <TextAreaField
            id="review-remarks"
            label={dict.drafts.remarksTitle}
            hint={dict.drafts.remarksHint}
            error={remarksError ?? undefined}
            rows={4}
            value={remarks}
            maxLength={1000}
            disabled={!canDecide}
            onChange={(event) => {
              setRemarks(event.target.value);
              setRemarksError(null);
            }}
            counter={formatMessage(dict.drafts.charCounter, {
              count: charCount(remarks),
              max: 1000,
            })}
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={!canDecide || approve.isPending}
              onClick={() => setApproveOpen(true)}
            >
              {dict.drafts.approve}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canDecide || reject.isPending}
              onClick={() => setRejectOpen(true)}
            >
              {dict.drafts.reject}
            </Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">{dict.drafts.claimNote}</p>
        </CardBody>
      </Card>

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title={dict.drafts.approve}
        closeLabel={dict.drafts.back}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveOpen(false)}>
              {dict.drafts.back}
            </Button>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
              {dict.drafts.approve}
            </Button>
          </>
        }
      >
        <p>{dict.drafts.approveConfirm}</p>
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={dict.drafts.reject}
        closeLabel={dict.drafts.back}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              {dict.drafts.back}
            </Button>
            <Button variant="danger" onClick={submitReject} disabled={reject.isPending}>
              {dict.drafts.reject}
            </Button>
          </>
        }
      >
        <p>{dict.drafts.rejectConfirm}</p>
        {remarksError ? (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {remarksError}
          </p>
        ) : null}
      </Modal>

      <p className="mt-6 text-xs leading-5 text-muted">{dict.common.footerDisclaimer}</p>
    </div>
  );
}

export function ReviewWorkspace({ id, locale, dict }: { id: number; locale: Locale; dict: Dictionary }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <ReviewInner id={id} locale={locale} dict={dict} />
    </QueryClientProvider>
  );
}
