import Link from 'next/link';

import { AuthLayout } from '@/components/site/AuthLayout';
import { FormAlert } from '@/components/ui/FormAlert';
import { VerifyOtpForm } from '@/features/auth/VerifyOtpForm';
import { getDictionary } from '@/i18n';
import { devOtpFor } from '@/server/http/devOtp';
import { pageLocale } from '@/server/http/pageLocale';

export const dynamic = 'force-dynamic';

interface VerifyOtpPageProps {
  searchParams: Promise<{ email?: string; dest?: string; lang?: string }>;
}

export default async function VerifyOtpPage({ searchParams }: VerifyOtpPageProps) {
  const params = await searchParams;
  const locale = await pageLocale(params.lang);
  const dict = getDictionary(locale);
  const email = params.email?.trim() ?? '';
  const destination = params.dest?.trim() ?? '';

  return (
    <AuthLayout
      locale={locale}
      dict={dict}
      pathname="/verify-otp"
      title={dict.auth.otpTitle}
      subtitle={dict.auth.otpSubtitle}
      footer={
        <Link
          href={{ pathname: '/login', query: { lang: locale } }}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {dict.auth.backToLogin}
        </Link>
      }
    >
      {email === '' ? (
        <div className="mt-6 space-y-4">
          <FormAlert>{dict.auth.missingEmail}</FormAlert>
          <Link
            href={{ pathname: '/register', query: { lang: locale } }}
            className="inline-flex h-11 w-full items-center justify-center rounded-input bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {dict.auth.createAccount}
          </Link>
        </div>
      ) : (
        <>
          {destination !== '' ? (
            <p className="mt-4 rounded-input bg-primary-tint px-3.5 py-2.5 text-sm text-primary">
              {dict.auth.otpSentTo.replace('{{destination}}', destination)}
            </p>
          ) : null}

          <VerifyOtpForm dict={dict} locale={locale} email={email} initialDevCode={devOtpFor(email)} />
        </>
      )}
    </AuthLayout>
  );
}
