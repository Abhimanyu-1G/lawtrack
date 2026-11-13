import Link from 'next/link';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SkipLink } from '@/components/site/SkipLink';
import { getDictionary } from '@/i18n';
import { pageLocale } from '@/server/http/pageLocale';

interface ForbiddenPageProps {
  searchParams: Promise<{ lang?: string }>;
}

/** Friendly 403 page reached when a signed-in user opens another role's area. */
export default async function ForbiddenPage({ searchParams }: ForbiddenPageProps) {
  const params = await searchParams;
  const locale = await pageLocale(params.lang);
  const dict = getDictionary(locale);

  return (
    <div lang={locale === 'hi' ? 'hi-IN' : 'en-IN'}>
      <SkipLink label={dict.common.skipToContent} />
      <SiteHeader locale={locale} dict={dict} pathname="/forbidden" />
      <main id="main-content" className="mx-auto w-full max-w-shell px-5 py-20 sm:px-8">
        <p className="font-serif text-6xl font-semibold text-primary">403</p>
        <h1 className="mt-4 text-3xl">{dict.forbidden.title}</h1>
        <p className="mt-3 max-w-prose text-muted">{dict.forbidden.body}</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-input bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {dict.forbidden.home}
        </Link>
      </main>
      <SiteFooter dict={dict} />
    </div>
  );
}
