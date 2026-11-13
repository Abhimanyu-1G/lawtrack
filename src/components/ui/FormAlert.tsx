import type { ReactNode } from 'react';

/**
 * Form-level message. `role="alert"` keeps asynchronous failures announced,
 * and the status colour is always paired with text (AGENTS.md §15).
 */
export function FormAlert({
  children,
  tone = 'danger',
}: {
  children: ReactNode;
  tone?: 'danger' | 'success' | 'info';
}) {
  const palette = {
    danger: 'border-danger/30 bg-danger-tint text-danger',
    success: 'border-success/30 bg-success-tint text-success',
    info: 'border-primary/25 bg-primary-tint text-primary',
  } as const;

  return (
    <div role="alert" className={`rounded-input border px-3.5 py-2.5 text-sm leading-6 ${palette[tone]}`}>
      {children}
    </div>
  );
}
