import type { TextareaHTMLAttributes } from 'react';

interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  rows?: number;
  counter?: string;
}

/** Labelled textarea with hint, optional counter and inline error. */
export function TextAreaField({
  id,
  label,
  hint,
  error,
  rows = 6,
  counter,
  ...textareaProps
}: TextAreaFieldProps) {
  const describedBy =
    [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {counter ? <span className="text-xs text-muted">{counter}</span> : null}
      </div>
      <textarea
        {...textareaProps}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 w-full rounded-input border bg-surface px-3.5 py-2.5 text-[0.95rem] leading-6 text-ink shadow-sm outline-none transition-colors placeholder:text-muted/70 focus:border-primary ${
          error ? 'border-danger' : 'border-line'
        }`}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
