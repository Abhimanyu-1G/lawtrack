'use client';

import { useState } from 'react';

import type { Dictionary } from '../../i18n';

/**
 * Print and share controls for a guide (AGENTS.md §15). Sharing falls back to
 * copying the address when the Web Share API is unavailable, and the outcome is
 * announced through a live region so keyboard and screen-reader users hear it.
 */
export function GuideActions({ dict }: { dict: Dictionary }) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleShare(): Promise<void> {
    try {
      const url = window.location.href;
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage(dict.knowledge.linkCopied);
    } catch {
      setMessage(dict.knowledge.shareUnavailable);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
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
          <path d="M7 9V4h10v5M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7v-6Z" />
        </svg>
        {dict.knowledge.print}
      </button>

      <button
        type="button"
        onClick={() => void handleShare()}
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
          <path d="M12 3v11M8 7l4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
        </svg>
        {dict.knowledge.share}
      </button>

      <p aria-live="polite" className="text-xs text-muted">
        {message}
      </p>
    </div>
  );
}
