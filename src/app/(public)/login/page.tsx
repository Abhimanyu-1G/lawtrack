import Link from 'next/link';

import { AuthLayout } from '@/components/site/AuthLayout';
import { LoginForm } from '@/features/auth/LoginForm';
import { getDictionary } from '@/i18n';
import { redirectIfSignedIn } from '@/server/http/pageAuth';
import { pageLocale } from '@/server/http/pageLocale';

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<{ lang?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await redirectIfSignedIn();

  const params = await searchParams;
  const locale = await pageLocale(params.lang);
  const dict = getDictionary(locale);

  return (
    <AuthLayout
      locale={locale}
      dict={dict}
      pathname="/login"
      title={dict.auth.loginTitle}
      subtitle={dict.auth.loginSubtitle}
      footer={
        <p className="text-muted">
          {dict.auth.noAccount}{' '}
          <Link
            href={{ pathname: '/register', query: { lang: locale } }}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {dict.auth.createAccount}
          </Link>
        </p>
      }
    >
      <LoginForm dict={dict} locale={locale} next={params.next} />
    </AuthLayout>
  );
}
