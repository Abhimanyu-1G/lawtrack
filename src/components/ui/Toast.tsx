'use client';

import type { ReactNode } from 'react';

/**
 * Polite toast region. The first toast carries an icon and text, so the tone is
 * never communicated by colour alone (AGENTS.md §15).
 */
export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<ToastTone, string> = {
  info: 'border-primary/30 bg-primary-tint text-primary',
  success: 'border-success/30 bg-success-tint text-success',
  warning: 'border-warning/30 bg-warning-tint text-warning',
  danger: 'border-danger/30 bg-danger-tint text-danger',
};

export function Toast({
  message,
  tone = 'info',
  onDismiss,
  dismissLabel,
}: {
  message: string;
  tone?: ToastTone;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-card border px-4 py-3 text-sm font-medium shadow-soft ${TONES[tone]}`}
    >
      <p className="leading-6">{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel ?? 'Dismiss'}
          className="rounded-input px-1 text-lg leading-none opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function ToastRegion({ children }: { children: ReactNode }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 mx-auto flex w-full max-w-md flex-col gap-2 px-4 lg:bottom-6"
    >
      <div className="pointer-events-auto flex flex-col gap-2">{children}</div>
    </div>
  );
}
