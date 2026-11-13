'use client';

import { useState } from 'react';

import { FormAlert } from '../../components/ui/FormAlert';
import { SelectField } from '../../components/ui/SelectField';
import type { Dictionary, Locale } from '../../i18n';
import type { LawyerStatus } from '../../shared/enums';
import { setLawyerStatus } from './api';

/**
 * Lawyer availability switch (AGENTS.md §6, §15). `Available` puts the lawyer
 * on the chatbot help-request list; the choice is persisted immediately.
 */
export function AvailabilitySwitch({
  initial,
  locale,
  dict,
}: {
  initial: LawyerStatus;
  locale: Locale;
  dict: Dictionary;
}) {
  const [status, setStatus] = useState<LawyerStatus>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function change(next: LawyerStatus): Promise<void> {
    setStatus(next);
    setSaved(false);
    setError(null);
    setPending(true);
    try {
      await setLawyerStatus(next, locale);
      setSaved(true);
    } catch {
      setStatus(initial);
      setError(dict.drafts.statusError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <SelectField
        id="lawyer-availability"
        label={dict.drafts.statusLabel}
        value={status}
        disabled={pending}
        onChange={(event) => void change(event.target.value as LawyerStatus)}
      >
        <option value="Available">{dict.drafts.statusAvailable}</option>
        <option value="Busy">{dict.drafts.statusBusy}</option>
        <option value="Offline">{dict.drafts.statusOffline}</option>
      </SelectField>
      {saved ? (
        <p role="status" className="mt-1.5 text-xs font-medium text-success">
          {dict.drafts.statusSaved}
        </p>
      ) : null}
      {error ? (
        <div className="mt-2">
          <FormAlert>{error}</FormAlert>
        </div>
      ) : null}
    </div>
  );
}
