'use client';

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';

import type { Dictionary, Locale } from '../../i18n';
import { FormAlert } from '../../components/ui/FormAlert';
import { apiRequest } from './api';
import { fieldErrorMap, formErrorMessage } from './messages';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

interface VerifyResponse {
  user: { id: number; role: string };
  redirectTo: string;
}

interface ResendResponse {
  sent: boolean;
  retryAfterSeconds?: number;
  devOtp?: string;
}

export function VerifyOtpForm({
  dict,
  locale,
  email,
  initialDevCode,
}: {
  dict: Dictionary;
  locale: Locale;
  email: string;
  initialDevCode: string | null;
}) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() => Array<string>(CODE_LENGTH).fill(''));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(initialDevCode);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  function applyDigits(start: number, raw: string): void {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.length === 0) return;

    setDigits((current) => {
      const next = [...current];
      for (let offset = 0; offset < cleaned.length && start + offset < CODE_LENGTH; offset += 1) {
        next[start + offset] = cleaned[offset] ?? '';
      }
      return next;
    });

    setFieldError(null);
    const focusAt = Math.min(start + cleaned.length, CODE_LENGTH - 1);
    inputs.current[focusAt]?.focus();
  }

  function handleChange(index: number, value: string): void {
    if (value === '') {
      setDigits((current) => {
        const next = [...current];
        next[index] = '';
        return next;
      });
      return;
    }
    applyDigits(index, value);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      event.preventDefault();
      setDigits((current) => {
        const next = [...current];
        next[index - 1] = '';
        return next;
      });
      inputs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();
    applyDigits(0, event.clipboardData.getData('text'));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const code = digits.join('');

    if (code.length !== CODE_LENGTH) {
      setFieldError(dict.auth.codeInvalid);
      inputs.current[code.length]?.focus();
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const response = await apiRequest<VerifyResponse>('/api/auth/verify-otp', {
        method: 'POST',
        locale,
        body: { email, code },
      });
      router.replace(response.redirectTo);
      router.refresh();
    } catch (error) {
      const errors = fieldErrorMap(error);
      setFieldError(errors.code ?? null);
      setFormError(formErrorMessage(error, dict));
      setSubmitting(false);
    }
  }

  async function handleResend(): Promise<void> {
    setResending(true);
    setFormError(null);
    setNotice(null);

    try {
      const response = await apiRequest<ResendResponse>('/api/auth/resend-otp', {
        method: 'POST',
        locale,
        body: { email },
      });

      if (!response.sent) {
        setFormError(dict.auth.genericError);
        return;
      }

      setNotice(dict.auth.resendSuccess);
      setSeconds(response.retryAfterSeconds ?? RESEND_SECONDS);
      if (response.devOtp) setDevCode(response.devOtp);
      setDigits(Array<string>(CODE_LENGTH).fill(''));
      setFieldError(null);
      inputs.current[0]?.focus();
    } catch (error) {
      setFormError(formErrorMessage(error, dict));
    } finally {
      setResending(false);
    }
  }

  return (
    <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      {notice ? <FormAlert tone="success">{notice}</FormAlert> : null}

      <fieldset>
        <legend className="sr-only">{dict.auth.otpLabel}</legend>
        <div className="flex justify-between gap-2 sm:gap-3">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              value={digit}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={CODE_LENGTH}
              aria-label={`${dict.auth.otpLabel} ${index + 1}`}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'otp-error' : undefined}
              className={`h-12 w-full max-w-[3.25rem] rounded-input border bg-surface text-center text-xl font-semibold text-ink shadow-sm outline-none transition-colors focus:border-primary sm:h-14 ${
                fieldError ? 'border-danger' : 'border-line'
              }`}
            />
          ))}
        </div>
        {fieldError ? (
          <p id="otp-error" role="alert" className="mt-2 text-xs font-medium text-danger">
            {fieldError}
          </p>
        ) : null}
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-11 w-full items-center justify-center rounded-input bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? dict.auth.verifying : dict.auth.verifyAction}
      </button>

      <div className="flex flex-col gap-1 border-t border-line pt-4 text-sm">
        <span className="text-muted">{dict.auth.resendPrompt}</span>
        {seconds > 0 ? (
          <span className="text-muted">{dict.auth.resendIn.replace('{{seconds}}', String(seconds))}</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-fit rounded-input font-semibold text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending ? dict.auth.resending : dict.auth.resendAction}
          </button>
        )}
        <p className="mt-1 text-xs leading-5 text-muted">{dict.auth.otpPrivacy}</p>
      </div>

      {devCode ? (
        <div
          aria-live="polite"
          className="rounded-input border border-dashed border-primary/40 bg-primary-tint px-3.5 py-3 text-xs leading-5 text-primary"
        >
          <p>{dict.auth.devOtpHint}</p>
          <p className="mt-1 font-medium">
            {dict.auth.devOtpCode}: <span className="font-mono text-lg tracking-[0.3em]">{devCode}</span>
          </p>
        </div>
      ) : null}
    </form>
  );
}
