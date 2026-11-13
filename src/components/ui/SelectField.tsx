import type { ReactNode, SelectHTMLAttributes } from 'react';

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** Labelled native select — native controls keep keyboard and mobile support. */
export function SelectField({ id, label, hint, error, children, ...selectProps }: SelectFieldProps) {
  const describedBy =
    [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        {...selectProps}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 h-11 w-full rounded-input border bg-surface px-3 text-[0.95rem] text-ink shadow-sm outline-none transition-colors focus:border-primary ${
          error ? 'border-danger' : 'border-line'
        }`}
      >
        {children}
      </select>

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
