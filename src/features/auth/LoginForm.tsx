'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import type { Dictionary, Locale } from '../../i18n';
import { FormAlert } from '../../components/ui/FormAlert';
import { TextField } from '../../components/ui/TextField';
import { apiRequest, safeNextPath } from './api';
import { fieldErrorMap, formErrorMessage } from './messages';

interface LoginResponse {
  user: { id: number; role: string };
  redirectTo: string;
}

export function LoginForm({ dict, locale, next }: { dict: Dictionary; locale: Locale; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearField(field: string): void {
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const response = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        locale,
        body: { email: email.trim(), password },
      });

      setFieldErrors({});
      router.replace(safeNextPath(next) ?? response.redirectTo);
      router.refresh();
    } catch (error) {
      setFieldErrors(fieldErrorMap(error));
      setFormError(formErrorMessage(error, dict));
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert>{formError}</FormAlert> : null}

      <TextField
        id="email"
        name="email"
        type="email"
        label={dict.auth.emailLabel}
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        error={fieldErrors.email}
        onChange={(event) => {
          setEmail(event.target.value);
          clearField('email');
        }}
      />

      <TextField
        id="password"
        name="password"
        type="password"
        label={dict.auth.passwordLabel}
        autoComplete="current-password"
        required
        value={password}
        error={fieldErrors.password}
        revealLabels={{ show: dict.auth.showPassword, hide: dict.auth.hidePassword }}
        onChange={(event) => {
          setPassword(event.target.value);
          clearField('password');
        }}
      />

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-11 w-full items-center justify-center rounded-input bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? dict.auth.signingIn : dict.auth.signIn}
      </button>
    </form>
  );
}
