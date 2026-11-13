'use client';

import { useState, type InputHTMLAttributes } from 'react';

/**
 * Labelled text input with hint, inline error and an optional reveal toggle for
 * passwords (AGENTS.md §15). Errors are announced politely and linked through
 * `aria-describedby`, so a screen reader reads the rule that failed.
 */

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
  revealLabels?: { show: string; hide: string };
}

export function TextField({
  id,
  label,
  hint,
  error,
  optionalLabel,
  revealLabels,
  type = 'text',
  ...inputProps
}: TextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const revealable = revealLabels !== undefined && type === 'password';
  const describedBy =
    [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {optionalLabel ? <span className="text-xs text-muted">{optionalLabel}</span> : null}
      </div>

      <div className="relative mt-1.5">
        <input
          {...inputProps}
          id={id}
          type={revealable && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-11 w-full rounded-input border bg-surface px-3.5 text-[0.95rem] text-ink shadow-sm outline-none transition-colors placeholder:text-muted/70 focus:border-primary ${
            error ? 'border-danger' : 'border-line'
          } ${revealable ? 'pr-20' : ''}`}
        />

        {revealable ? (
          <button
            type="button"
            aria-pressed={revealed}
            onClick={() => setRevealed((current) => !current)}
            className="absolute inset-y-0 right-1 my-auto h-8 rounded-input px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-tint"
          >
            {revealed ? revealLabels.hide : revealLabels.show}
          </button>
        ) : null}
      </div>

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
