'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Dictionary, Locale } from '../../i18n';
import { apiRequest } from '../auth/api';

/**
 * Workspace language switch. Unlike the public switch (a query parameter), a
 * signed-in user's language is a profile setting, so this persists the choice
 * through `PATCH /api/auth/profile` and refreshes the server-rendered layout.
 */
export function LanguagePreference({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: Locale): Promise<void> {
    if (next === locale || busy) return;

    setBusy(true);
    setError(null);

    try {
      await apiRequest<{ user: unknown }>('/api/auth/profile', {
        method: 'PATCH',
        locale,
        body: { language: next === 'hi' ? 'Hindi' : 'English' },
      });
      router.refresh();
    } catch {
      setError(dict.workspace.languageError);
    } finally {
      setBusy(false);
    }
  }

  const options: { value: Locale; label: string }[] = [
    { value: 'en', label: dict.common.english },
    { value: 'hi', label: dict.common.hindi },
  ];

  return (
    <div>
      <div
        role="group"
        aria-label={dict.common.languageLabel}
        className="inline-flex rounded-pill border border-line bg-surface p-0.5"
      >
        {options.map((option) => {
          const active = option.value === locale;
          return (
            <button
              key={option.value}
              type="button"
              lang={option.value === 'hi' ? 'hi-IN' : 'en-IN'}
              aria-pressed={active}
              disabled={busy}
              onClick={() => choose(option.value)}
              className={`inline-flex h-8 items-center rounded-pill px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                active ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
