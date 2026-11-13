'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FormAlert } from '../../components/ui/FormAlert';
import { SelectField } from '../../components/ui/SelectField';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import { categoryLabel, type Dictionary, type Locale } from '../../i18n';
import { CATEGORY_NAMES, type GuideStatus } from '../../shared/enums';
import { ApiRequestError, apiRequest } from '../auth/api';
import { formatGuideDate } from '../knowledge/format';
import { GuideStatusBadge } from './GuideStatusBadge';
import type { GuideDetailDto, GuideDto } from '../../server/modules/guides/service';

interface Feedback {
  tone: 'success' | 'danger' | 'info';
  text: string;
}

const STATUS_HINT: Record<GuideStatus, 'statusHintDraft' | 'statusHintValid' | 'statusHintRequires'> = {
  Draft: 'statusHintDraft',
  Valid: 'statusHintValid',
  'Requires AI Update': 'statusHintRequires',
};

const SUMMARY_MAX = 8000;
const EXCERPT_MAX = 2000;
const REASON_MIN = 10;

/**
 * Curator review workspace (AGENTS.md §6, §15): the source statute and excerpt
 * sit next to the plain-language summary, with save, demo re-simplify, validate
 * and flag actions. The server owns every transition, audit row and embedding
 * refresh; this form only sends the content and renders the outcome.
 */
export function GuideReviewEditor({
  guide,
  dict,
  locale,
}: {
  guide: GuideDetailDto;
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: guide.title,
    category: guide.category,
    plain_summary: guide.summary,
    source_statute: guide.statute,
    source_excerpt: guide.sourceExcerpt ?? '',
  });
  const [status, setStatus] = useState<GuideStatus>(guide.status);
  const [lastUpdated, setLastUpdated] = useState(guide.lastUpdated);
  const [curatorId, setCuratorId] = useState(guide.curatorId);
  const [busy, setBusy] = useState<'save' | 'resimplify' | 'validate' | 'flag' | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [flagOpen, setFlagOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  function applyGuide(next: GuideDto): void {
    setForm({
      title: next.title,
      category: next.category,
      plain_summary: next.summary,
      source_statute: next.statute,
      source_excerpt: next.sourceExcerpt ?? '',
    });
    setStatus(next.status);
    setLastUpdated(next.lastUpdated);
    setCuratorId(next.curatorId);
  }

  function handleError(error: unknown): void {
    if (error instanceof ApiRequestError) {
      const map: Record<string, string> = {};
      for (const field of error.fields) map[field.field] = field.message;
      setFieldErrors(map);
      setFeedback({
        tone: 'danger',
        text: error.fields.length === 0 ? error.message : dict.curator.actionError,
      });
      return;
    }
    setFeedback({ tone: 'danger', text: dict.curator.actionError });
  }

  function clearMessages(): void {
    setFeedback(null);
    setFieldErrors({});
  }

  async function save(): Promise<void> {
    clearMessages();
    setBusy('save');
    try {
      const data = await apiRequest<{ guide: GuideDto }>(`/api/curator/guides/${guide.id}`, {
        method: 'PATCH',
        locale,
        body: {
          title: form.title,
          category: form.category,
          plain_summary: form.plain_summary,
          source_statute: form.source_statute,
          source_excerpt: form.source_excerpt.trim() === '' ? null : form.source_excerpt,
        },
      });
      applyGuide(data.guide);
      setFeedback({ tone: 'success', text: dict.curator.saved });
      router.refresh();
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(null);
    }
  }

  async function resimplify(): Promise<void> {
    clearMessages();
    setBusy('resimplify');
    try {
      const data = await apiRequest<{
        suggestion: { text: string; model: string; demo: boolean };
      }>(`/api/curator/guides/${guide.id}/resimplify`, { method: 'POST', locale });
      setForm((current) => ({ ...current, plain_summary: data.suggestion.text }));
      setFeedback({ tone: 'info', text: dict.curator.resimplifyReady });
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(null);
    }
  }

  async function validate(): Promise<void> {
    clearMessages();
    setBusy('validate');
    try {
      const data = await apiRequest<{ guide: GuideDto }>(
        `/api/curator/guides/${guide.id}/validate`,
        { method: 'POST', locale },
      );
      applyGuide(data.guide);
      setFeedback({ tone: 'success', text: dict.curator.validated });
      router.refresh();
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(null);
    }
  }

  async function flag(): Promise<void> {
    clearMessages();
    setReasonError(null);
    if (reason.trim().length < REASON_MIN) {
      setReasonError(dict.validation.guideReasonTooShort.replace('{{min}}', String(REASON_MIN)));
      return;
    }

    setBusy('flag');
    try {
      const data = await apiRequest<{ guide: GuideDto }>(
        `/api/curator/guides/${guide.id}/flag`,
        { method: 'POST', locale, body: { reason } },
      );
      applyGuide(data.guide);
      setFlagOpen(false);
      setReason('');
      setFeedback({ tone: 'success', text: dict.curator.flagged });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const reasonField = error.fields.find((field) => field.field === 'reason');
        if (reasonField) setReasonError(reasonField.message);
      }
      handleError(error);
    } finally {
      setBusy(null);
    }
  }

  const alternate = guide.alternate;
  const alternateLabel = alternate
    ? alternate.language === 'Hindi'
      ? dict.common.hindi
      : dict.common.english
    : null;

  return (
    <div className="max-w-6xl animate-fade-in">
      <Link
        href="/curator/guides"
        className="inline-flex items-center gap-1.5 rounded-input text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-primary hover:underline"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        {dict.curator.backToList}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {dict.curator.editorTitle}
          </p>
          <h1 className="mt-2 text-2xl leading-tight sm:text-3xl">{form.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <GuideStatusBadge status={status} dict={dict} />
            <span className="text-xs text-muted">
              {dict.curator.lastUpdated.replace('{{date}}', formatGuideDate(lastUpdated, locale))}
            </span>
            {curatorId ? (
              <span className="text-xs text-muted">
                {dict.curator.validatedBy.replace('{{id}}', String(curatorId))}
              </span>
            ) : null}
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            {dict.curator[STATUS_HINT[status]]}
          </p>
        </div>

        {alternate && alternateLabel ? (
          <Link
            href={`/curator/guides/${alternate.id}`}
            className="inline-flex h-9 items-center gap-2 rounded-input border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 5h7M7.5 5c0 6-2 9-4.5 11M5 9c1.5 3.5 3.5 5.5 6.5 6.5M13 20l4-11 4 11M14.5 16h5" />
            </svg>
            {dict.curator.openPair.replace('{{language}}', alternateLabel)}
          </Link>
        ) : (
          <span className="text-xs text-muted">{dict.curator.noPair}</span>
        )}
      </div>

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {feedback ? (
          <div className="mb-4">
            <FormAlert tone={feedback.tone}>{feedback.text}</FormAlert>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-card border border-line bg-surface p-5 shadow-soft">
            <h2 className="text-lg">{dict.curator.sourcePanelTitle}</h2>
            <div className="mt-4 space-y-4">
              <TextField
                id="guide-statute"
                label={dict.curator.statuteLabel}
                value={form.source_statute}
                maxLength={200}
                error={fieldErrors.source_statute}
                onChange={(event) =>
                  setForm((current) => ({ ...current, source_statute: event.target.value }))
                }
              />
              <TextAreaField
                id="guide-excerpt"
                label={dict.curator.excerptLabel}
                rows={9}
                value={form.source_excerpt}
                error={fieldErrors.source_excerpt}
                counter={`${form.source_excerpt.length}/${EXCERPT_MAX}`}
                onChange={(event) =>
                  setForm((current) => ({ ...current, source_excerpt: event.target.value }))
                }
              />
            </div>
          </section>

          <section className="rounded-card border border-line bg-surface p-5 shadow-soft">
            <h2 className="text-lg">{dict.curator.summaryPanelTitle}</h2>
            <div className="mt-4 space-y-4">
              <TextField
                id="guide-title"
                label={dict.curator.titleLabel}
                value={form.title}
                maxLength={150}
                error={fieldErrors.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
              <SelectField
                id="guide-category"
                label={dict.curator.categoryLabel}
                value={form.category}
                error={fieldErrors.category}
                onChange={(event) =>
                  setForm((current) => ({ ...current, category: event.target.value }))
                }
              >
                {CATEGORY_NAMES.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(dict, category)}
                  </option>
                ))}
              </SelectField>
              <TextAreaField
                id="guide-summary"
                label={dict.curator.summaryLabel}
                hint={dict.curator.summaryHint}
                rows={12}
                value={form.plain_summary}
                error={fieldErrors.plain_summary}
                counter={`${form.plain_summary.length}/${SUMMARY_MAX}`}
                onChange={(event) =>
                  setForm((current) => ({ ...current, plain_summary: event.target.value }))
                }
              />
            </div>
          </section>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-4 shadow-soft">
          <button
            type="submit"
            disabled={busy !== null}
            className="inline-flex h-10 items-center rounded-input bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'save' ? dict.curator.saving : dict.curator.save}
          </button>

          <button
            type="button"
            onClick={() => void resimplify()}
            disabled={busy !== null}
            className="inline-flex h-10 items-center gap-2 rounded-input border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'resimplify' ? dict.curator.resimplifying : dict.curator.resimplify}
            <span className="rounded-pill bg-primary-tint px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
              {dict.curator.demoBadge}
            </span>
          </button>

          {status !== 'Valid' ? (
            <button
              type="button"
              onClick={() => void validate()}
              disabled={busy !== null}
              className="inline-flex h-10 items-center rounded-input border border-success/40 bg-success-tint px-4 text-sm font-semibold text-success transition-colors hover:border-success disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'validate' ? dict.curator.validating : dict.curator.validate}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFlagOpen(true);
                setFeedback(null);
              }}
              disabled={busy !== null}
              className="inline-flex h-10 items-center rounded-input border border-danger/30 bg-danger-tint px-4 text-sm font-semibold text-danger transition-colors hover:border-danger disabled:cursor-not-allowed disabled:opacity-60"
            >
              {dict.curator.flag}
            </button>
          )}
        </div>

        <p className="mt-2 text-xs leading-5 text-muted">{dict.curator.resimplifyHint}</p>
      </form>

      {flagOpen ? (
        <section className="mt-5 rounded-card border border-danger/30 bg-danger-tint/40 p-5">
          <h2 className="text-lg">{dict.curator.flagTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{dict.curator.flagHint}</p>
          <div className="mt-3">
            <TextAreaField
              id="flag-reason"
              label={dict.curator.flagReasonLabel}
              rows={3}
              value={reason}
              error={reasonError ?? undefined}
              counter={`${reason.length}/500`}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void flag()}
              disabled={busy !== null}
              className="inline-flex h-10 items-center rounded-input bg-danger px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'flag' ? dict.curator.flagging : dict.curator.flagSubmit}
            </button>
            <button
              type="button"
              onClick={() => {
                setFlagOpen(false);
                setReasonError(null);
              }}
              disabled={busy !== null}
              className="inline-flex h-10 items-center rounded-input border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-primary/40 hover:text-primary"
            >
              {dict.curator.cancel}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
