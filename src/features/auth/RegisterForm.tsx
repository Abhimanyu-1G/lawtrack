'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import type { Dictionary, Locale } from '../../i18n';
import { FormAlert } from '../../components/ui/FormAlert';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { apiRequest } from './api';
import { fieldErrorMap, formErrorMessage } from './messages';

interface RegisterResponse {
  user: { id: number; email: string };
  delivery: { channel: 'SMS' | 'Email'; destination: string };
  next: string;
}

export function RegisterForm({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<'English' | 'Hindi'>(locale === 'hi' ? 'Hindi' : 'English');
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
      const response = await apiRequest<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        locale,
        body: {
          name: name.trim(),
          email: email.trim(),
          ...(phone.trim() === '' ? {} : { phone_number: phone.trim() }),
          password,
          role: 'Citizen',
          language,
        },
      });

      const query = new URLSearchParams({
        email: response.user.email,
        dest: response.delivery.destination,
        lang: locale,
      });
      router.push(`/verify-otp?${query.toString()}`);
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
        id="name"
        name="name"
        label={dict.auth.nameLabel}
        autoComplete="name"
        required
        value={name}
        error={fieldErrors.name}
        onChange={(event) => {
          setName(event.target.value);
          clearField('name');
        }}
      />

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
        id="phone"
        name="phone_number"
        type="tel"
        label={dict.auth.phoneLabel}
        hint={dict.auth.phoneOptional}
        optionalLabel={dict.auth.optional}
        autoComplete="tel"
        inputMode="tel"
        value={phone}
        error={fieldErrors.phone_number}
        onChange={(event) => {
          setPhone(event.target.value);
          clearField('phone_number');
        }}
      />

      <TextField
        id="password"
        name="password"
        type="password"
        label={dict.auth.passwordLabel}
        hint={dict.auth.passwordHint}
        autoComplete="new-password"
        required
        value={password}
        error={fieldErrors.password}
        revealLabels={{ show: dict.auth.showPassword, hide: dict.auth.hidePassword }}
        onChange={(event) => {
          setPassword(event.target.value);
          clearField('password');
        }}
      />

      <SelectField
        id="language"
        name="language"
        label={dict.validation.fields.language}
        value={language}
        error={fieldErrors.language}
        onChange={(event) => {
          setLanguage(event.target.value === 'Hindi' ? 'Hindi' : 'English');
          clearField('language');
        }}
      >
        <option value="English">{dict.common.english}</option>
        <option value="Hindi">{dict.common.hindi}</option>
      </SelectField>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-11 w-full items-center justify-center rounded-input bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? dict.auth.registering : dict.auth.registerAction}
      </button>

      <p className="text-xs leading-5 text-muted">{dict.auth.registerNote}</p>
    </form>
  );
}
