import Link from 'next/link';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SkipLink } from '@/components/site/SkipLink';
import { getDictionary } from '@/i18n';

/** 404 page. Not locale-aware (no query params available) — English by default. */
export default function NotFound() {
  const dict = getDictionary('en');

  return (
    <div lang="en-IN">
      <SkipLink label={dict.common.skipToContent} />
      <SiteHeader locale="en" dict={dict} pathname="/" />
      <main id="main-content" className="mx-auto w-full max-w-shell px-5 py-20 sm:px-8">
        <p className="font-serif text-6xl font-semibold text-primary">404</p>
        <h1 className="mt-4 text-3xl">{dict.notFound.title}</h1>
        <p className="mt-3 max-w-prose text-muted">{dict.notFound.body}</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center rounded-input bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {dict.notFound.home}
        </Link>
      </main>
      <SiteFooter dict={dict} />
    </div>
  );
}
