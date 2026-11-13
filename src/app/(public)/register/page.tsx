import Link from 'next/link';

import { AuthLayout } from '@/components/site/AuthLayout';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { getDictionary } from '@/i18n';
import { redirectIfSignedIn } from '@/server/http/pageAuth';
import { pageLocale } from '@/server/http/pageLocale';

export const dynamic = 'force-dynamic';

interface RegisterPageProps {
  searchParams: Promise<{ lang?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  await redirectIfSignedIn();

  const params = await searchParams;
  const locale = await pageLocale(params.lang);
  const dict = getDictionary(locale);

  return (
    <AuthLayout
      locale={locale}
      dict={dict}
      pathname="/register"
      title={dict.auth.registerTitle}
      subtitle={dict.auth.registerSubtitle}
      footer={
        <p className="text-muted">
          {dict.auth.haveAccount}{' '}
          <Link
            href={{ pathname: '/login', query: { lang: locale } }}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {dict.auth.signIn}
          </Link>
        </p>
      }
    >
      <RegisterForm dict={dict} locale={locale} />
    </AuthLayout>
  );
}
