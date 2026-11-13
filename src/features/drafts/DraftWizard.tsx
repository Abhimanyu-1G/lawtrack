'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/Card';
import { FormAlert } from '../../components/ui/FormAlert';
import { SelectField } from '../../components/ui/SelectField';
import { Stepper } from '../../components/ui/Stepper';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import { formatMessage, type Dictionary, type Locale } from '../../i18n';
import type { DraftType } from '../../shared/enums';
import { DRAFT_TYPES } from '../../shared/enums';
import {
  DRAFT_FORM_FIELDS,
  validateDraftFormInput,
  charCount,
  type DraftField,
} from '../../shared/validation';
import { ApiRequestError } from '../auth/api';
import { createDraft } from './api';
import { answerDisplay, draftTypeName } from './format';

/**
 * Citizen draft wizard (AGENTS.md §9): choose a type, answer the fields for
 * that type, review, then generate. Answers are kept in localStorage until the
 * draft is created, so an AI outage never loses the citizen's work.
 */

const STORAGE_KEY = 'lawtrack:draft:wizard';

type Stage = 'type' | 'answers' | 'review';

interface SavedState {
  type: DraftType | null;
  answers: Record<string, string | boolean>;
}

function readSaved(): SavedState {
  if (typeof window === 'undefined') return { type: null, answers: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { type: null, answers: {} };
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    const type =
      parsed.type && (DRAFT_TYPES as readonly string[]).includes(parsed.type)
        ? (parsed.type as DraftType)
        : null;
    const answers =
      parsed.answers && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers)
        ? (parsed.answers as Record<string, string | boolean>)
        : {};
    return { type, answers };
  } catch {
    return { type: null, answers: {} };
  }
}

function initialAnswers(fields: DraftField[], answers: Record<string, string | boolean>) {
  const next: Record<string, string | boolean> = {};
  for (const field of fields) {
    const saved = answers[field.name];
    if (field.kind === 'checkbox') next[field.name] = saved === true;
    else if (typeof saved === 'string') next[field.name] = saved;
    else next[field.name] = '';
  }
  return next;
}

function fieldLabel(dict: Dictionary, name: string): string {
  const labels = dict.drafts.fields as Record<string, string>;
  return labels[name] ?? name;
}

export function DraftWizard({
  locale,
  dict,
  demo,
  defaultName,
}: {
  locale: Locale;
  dict: Dictionary;
  demo: boolean;
  defaultName: string;
}) {
  const router = useRouter();
  const [saved] = useState<SavedState>(() => readSaved());
  const [type, setType] = useState<DraftType | null>(saved.type);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>(saved.answers);
  const [stage, setStage] = useState<Stage>(saved.type ? 'answers' : 'type');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restored] = useState(
    Boolean(saved.type && Object.values(saved.answers).some((value) => value !== '')),
  );

  const fields = useMemo(() => (type ? DRAFT_FORM_FIELDS[type] : []), [type]);

  useEffect(() => {
    if (!type) return;
    const payload: SavedState = { type, answers };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [type, answers]);

  const reviewRows = useMemo(
    () =>
      fields
        .map((field) => ({
          name: field.name,
          label: fieldLabel(dict, field.name),
          value: answers[field.name],
        }))
        .filter((row) => row.value !== '' && row.value !== false && row.value !== undefined),
    [fields, answers, dict],
  );

  function chooseType(next: DraftType): void {
    setType(next);
    setAnswers((current) => {
      const nextAnswers = initialAnswers(DRAFT_FORM_FIELDS[next], current);
      if (next === 'Complaint' && !nextAnswers.complainantName && defaultName) {
        nextAnswers.complainantName = defaultName;
      }
      if (next === 'RTI' && !nextAnswers.applicantName && defaultName) {
        nextAnswers.applicantName = defaultName;
      }
      if (next === 'Legal Notice' && !nextAnswers.senderName && defaultName) {
        nextAnswers.senderName = defaultName;
      }
      return nextAnswers;
    });
    setErrors({});
    setStage('answers');
  }

  function setValue(name: string, value: string | boolean): void {
    setAnswers((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function toPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = answers[field.name];
      if (field.kind === 'checkbox') {
        payload[field.name] = raw === true;
        continue;
      }
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text === '') continue;
      payload[field.name] = field.kind === 'number' ? Number(text) : text;
    }
    return payload;
  }

  function validate(): boolean {
    if (!type) return false;
    const result = validateDraftFormInput(type, toPayload(), locale);
    if (result.ok) {
      setErrors({});
      return true;
    }
    const next: Record<string, string> = {};
    for (const error of result.errors) {
      if (!next[error.field]) next[error.field] = error.message;
    }
    setErrors(next);
    setFormError(dict.drafts.actionFailed);
    return false;
  }

  async function submit(): Promise<void> {
    if (!type || !validate()) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const draft = await createDraft(
        { draft_type: type, form_data: toPayload() },
        locale,
      );
      window.localStorage.removeItem(STORAGE_KEY);
      router.push(`/citizen/drafts/${draft.id}`);
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : dict.drafts.createFailed;
      setFormError(message);
      if (error instanceof ApiRequestError && error.fields.length > 0) {
        const next: Record<string, string> = {};
        for (const field of error.fields) {
          if (!next[field.field]) next[field.field] = field.message;
        }
        setErrors(next);
      }
      setSubmitting(false);
    }
  }

  const steps = [
    {
      label: dict.drafts.stepAnswers,
      state: stage === 'answers' ? ('current' as const) : ('done' as const),
    },
    {
      label: dict.drafts.stepReview,
      state: stage === 'review' ? ('current' as const) : ('upcoming' as const),
    },
    {
      label: dict.drafts.stepStatus,
      state: 'upcoming' as const,
    },
  ];

  return (
    <div className="max-w-3xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {dict.drafts.eyebrow}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{dict.drafts.createTitle}</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">{dict.drafts.createIntro}</p>

      {demo ? (
        <div className="mt-4">
          <Badge tone="primary">{dict.chat.demoBadge}</Badge>
        </div>
      ) : null}

      <div className="mt-6">
        <Stepper steps={steps} label={dict.drafts.title} />
      </div>

      {restored && stage === 'answers' ? (
        <p className="mt-4 text-xs leading-5 text-muted">{dict.drafts.formRestored}</p>
      ) : null}

      {formError ? (
        <div className="mt-4">
          <FormAlert>{formError}</FormAlert>
        </div>
      ) : null}

      {stage === 'type' ? (
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-ink">{dict.drafts.chooseType}</legend>
          <div className="mt-3 grid gap-3">
            {DRAFT_TYPES.map((option) => {
              const body =
                option === 'Complaint'
                  ? dict.drafts.typeComplaintBody
                  : option === 'RTI'
                    ? dict.drafts.typeRtiBody
                    : dict.drafts.typeLegalNoticeBody;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => chooseType(option)}
                  className="rounded-card border border-line bg-surface px-5 py-4 text-left shadow-soft transition-colors hover:border-primary/60 hover:bg-primary-tint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span className="block font-serif text-lg text-ink">
                    {draftTypeName(dict, option)}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted">{body}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {stage === 'answers' && type ? (
        <Card className="mt-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle as="h2" className="text-lg">
              {draftTypeName(dict, type)}
            </CardTitle>
            <button
              type="button"
              onClick={() => setStage('type')}
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {dict.drafts.chooseType}
            </button>
          </CardHeader>
          <CardBody className="space-y-5">
            <p className="text-xs leading-5 text-muted">{dict.drafts.answersIntro}</p>

            {fields.map((field) => {
              const id = `draft-${field.name}`;
              const label = `${fieldLabel(dict, field.name)}${field.required ? ' *' : ''}`;
              const optional = field.required ? undefined : dict.drafts.optionalNote;
              const value = answers[field.name];
              const error = errors[field.name];

              if (field.kind === 'textarea') {
                const text = typeof value === 'string' ? value : '';
                return (
                  <TextAreaField
                    key={field.name}
                    id={id}
                    label={label}
                    error={error}
                    rows={field.maxLength && field.maxLength > 900 ? 6 : 4}
                    value={text}
                    maxLength={field.maxLength}
                    onChange={(event) => setValue(field.name, event.target.value)}
                    counter={
                      field.maxLength
                        ? formatMessage(dict.drafts.charCounter, {
                            count: charCount(text),
                            max: field.maxLength,
                          })
                        : undefined
                    }
                  />
                );
              }

              if (field.kind === 'checkbox') {
                return (
                  <div key={field.name}>
                    <label htmlFor={id} className="flex items-start gap-3 text-sm text-ink">
                      <input
                        id={id}
                        type="checkbox"
                        checked={value === true}
                        onChange={(event) => setValue(field.name, event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-line text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      <span>{label}</span>
                    </label>
                    {error ? (
                      <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              }

              if (field.kind === 'select') {
                return (
                  <SelectField
                    key={field.name}
                    id={id}
                    label={label}
                    error={error}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) => setValue(field.name, event.target.value)}
                  >
                    <option value="">{dict.drafts.selectPlaceholder}</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {fieldLabel(dict, option.labelKey)}
                      </option>
                    ))}
                  </SelectField>
                );
              }

              return (
                <TextField
                  key={field.name}
                  id={id}
                  label={label}
                  optionalLabel={optional}
                  error={error}
                  type={field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : 'text'}
                  min={field.kind === 'number' ? field.min : undefined}
                  max={field.kind === 'number' ? field.max : undefined}
                  maxLength={field.maxLength}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => setValue(field.name, event.target.value)}
                />
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <button
                type="button"
                onClick={() => {
                  window.localStorage.removeItem(STORAGE_KEY);
                  setAnswers(initialAnswers(fields, {}));
                  setErrors({});
                  setStage('type');
                }}
                className="text-sm font-semibold text-muted underline-offset-4 hover:text-primary hover:underline"
              >
                {dict.drafts.startOver}
              </button>
              <Button
                type="button"
                onClick={() => {
                  if (validate()) setStage('review');
                }}
              >
                {dict.drafts.next}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {stage === 'review' && type ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle as="h2" className="text-lg">
              {dict.drafts.reviewTitle}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm leading-6 text-muted">{dict.drafts.reviewIntro}</p>

            <dl className="mt-4 divide-y divide-line">
              {reviewRows.map((row) => (
                <div key={row.name} className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {row.label}
                  </dt>
                  <dd className="whitespace-pre-line text-sm leading-6 text-ink sm:col-span-2">
                    {answerDisplay(dict, row.name, row.value as string | number | boolean)}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <Button type="button" variant="secondary" onClick={() => setStage('answers')}>
                {dict.drafts.editAnswers}
              </Button>
              <Button type="button" onClick={submit} disabled={submitting}>
                {submitting ? dict.drafts.generating : dict.drafts.generate}
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">{dict.drafts.autosaveNote}</p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
