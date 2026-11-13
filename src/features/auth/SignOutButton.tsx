'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Dictionary } from '../../i18n';
import { apiRequest } from './api';

export function SignOutButton({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } catch {
      setError(dict.workspace.signOutError);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex h-9 items-center rounded-input border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? dict.auth.signingOut : dict.auth.signOut}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
