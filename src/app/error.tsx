'use client';

import { useEffect } from 'react';

import { getDictionary } from '@/i18n';

/**
 * Route-level error boundary. Shows a friendly message and the request id when
 * one is present in the error digest, so users can quote it in a bug report.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dict = getDictionary('en');

  useEffect(() => {
    // Surface the error for local debugging; production logging happens server-side.
    console.error('Route error boundary:', error.message);
  }, [error]);

  return (
    <main id="main-content" className="mx-auto w-full max-w-shell px-5 py-20 sm:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">LawTrack</p>
      <h1 className="mt-3 font-serif text-3xl">{dict.error.title}</h1>
      <p className="mt-3 max-w-prose text-muted">{dict.error.body}</p>
      {error.digest ? (
        <p className="mt-4 font-mono text-xs text-muted">Request id: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex h-11 items-center rounded-input bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {dict.error.retry}
      </button>
    </main>
  );
}
