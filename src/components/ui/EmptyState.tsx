import type { ReactNode } from 'react';

/** Friendly empty state: icon, short title, one sentence and an optional action. */
export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-pill bg-primary-tint text-primary">
        {icon ?? (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v16H6.5A2.5 2.5 0 0 0 4 22V6.5Zm16 0A2.5 2.5 0 0 0 17.5 4H12v16h5.5A2.5 2.5 0 0 1 20 22V6.5Z" />
          </svg>
        )}
      </div>
      <p className="mt-4 font-serif text-lg text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-prose text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
