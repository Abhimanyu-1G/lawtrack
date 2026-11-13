import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SkipLink } from '@/components/site/SkipLink';
import { GuideActions } from '@/features/knowledge/GuideActions';
import { formatGuideDate } from '@/features/knowledge/format';
import { categoryLabel, getDictionary, htmlLang, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { getPageSession } from '@/server/http/pageAuth';
import { pageLocale } from '@/server/http/pageLocale';
import { isAppError } from '@/server/lib/errors';
import { getGuidesService } from '@/server/modules/guides';
import type { GuideDetailDto } from '@/server/modules/guides/service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Legal guide',
};

interface GuidePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}

function indiaCodeSearch(statute: string): string {
  return `https://www.indiacode.nic.in/simple-search?query=${encodeURIComponent(statute)}`;
}

async function loadGuide(guideId: number, viewer: Awaited<ReturnType<typeof getPageSession>>) {
  try {
    return await getGuidesService().detailPublic(guideId, viewer);
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
}

export default async function GuidePage({ params, searchParams }: GuidePageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const guideId = Number(id);
  if (!Number.isInteger(guideId) || guideId < 1) notFound();

  const locale = await pageLocale(query.lang);
  const dict = getDictionary(locale);
  const session = await getPageSession();
  const guide: GuideDetailDto = await loadGuide(guideId, session);

  const guideLocale: Locale = guide.language === 'Hindi' ? 'hi' : 'en';
  const otherLocale: Locale = guideLocale === 'hi' ? 'en' : 'hi';
  const otherLabel = otherLocale === 'hi' ? dict.common.hindi : dict.common.english;
  const paragraphs = guide.summary
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const backHref = { pathname: '/knowledge', query: { lang: locale } };

  return (
    <div lang={htmlLang(locale)}>
      <SkipLink label={dict.common.skipToContent} />
      <SiteHeader
        locale={locale}
        dict={dict}
        pathname="/knowledge"
        showAuthLinks={!session}
        workspaceHref={session ? ROLE_HOME[session.role] : null}
      />

      <main id="main-content" className="mx-auto w-full max-w-shell px-5 pt-8 sm:px-8 sm:pt-10">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-input text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          {dict.knowledge.backToHub}
        </Link>

        <article className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-pill bg-primary-tint px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
                {categoryLabel(dict, guide.category)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-success/25 bg-success-tint px-2.5 py-1 text-[0.7rem] font-semibold text-success">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m5 12 4.5 4.5L19 7" />
                </svg>
                {dict.knowledge.verifiedBadge}
              </span>
            </div>

            <h1
              lang={htmlLang(guideLocale)}
              className="mt-4 text-3xl leading-[1.15] sm:text-[2.6rem]"
            >
              {guide.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <span>
                {dict.knowledge.lastValidated.replace(
                  '{{date}}',
                  formatGuideDate(guide.lastUpdated, locale),
                )}
              </span>
              {guide.alternate ? (
                <Link
                  href={{
                    pathname: `/knowledge/${guide.alternate.id}`,
                    query: { lang: otherLocale },
                  }}
                  hrefLang={otherLocale}
                  className="inline-flex items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 5h7M7.5 5c0 6-2 9-4.5 11M5 9c1.5 3.5 3.5 5.5 6.5 6.5M13 20l4-11 4 11M14.5 16h5" />
                  </svg>
                  {dict.knowledge.languageSwitch.replace('{{language}}', otherLabel)}
                </Link>
              ) : null}
            </div>

            <section className="mt-9" aria-labelledby="guide-meaning">
              <h2 id="guide-meaning" className="text-xl sm:text-2xl">
                {dict.knowledge.whatItMeans}
              </h2>
              <div
                lang={htmlLang(guideLocale)}
                className="prose-legal mt-4 max-w-prose text-ink"
              >
                {paragraphs.map((paragraph, index) => (
                  <p key={`${guide.id}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </section>

            <section className="mt-10 border-t border-line pt-8" aria-labelledby="guide-disclaimer">
              <div className="rounded-card border border-primary/20 bg-primary-tint/50 p-5">
                <h2 id="guide-disclaimer" className="flex items-center gap-2 text-base">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3Z" />
                    <path d="M12 8v5M12 16.5v.5" />
                  </svg>
                  {dict.knowledge.theLaw}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">{dict.knowledge.disclaimer}</p>
              </div>
            </section>
          </div>

          {/* Source panel ------------------------------------------------- */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-card border border-line bg-surface p-5 shadow-soft">
              <h2 className="text-base">{dict.knowledge.sourceStatute}</h2>
              <p
                lang={htmlLang(guideLocale)}
                className="mt-2 text-sm font-medium leading-6 text-ink"
              >
                {guide.statute}
              </p>

              {guide.sourceExcerpt ? (
                <div className="mt-4 border-l-2 border-primary/40 pl-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {dict.knowledge.sourceExcerpt}
                  </p>
                  <blockquote
                    lang={htmlLang(guideLocale)}
                    className="mt-2 text-sm leading-6 text-muted"
                  >
                    {guide.sourceExcerpt}
                  </blockquote>
                </div>
              ) : null}

              <a
                href={indiaCodeSearch(guide.statute)}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {dict.knowledge.sourceLinkLabel}
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                </svg>
              </a>

              <div className="mt-5 border-t border-line pt-4">
                <GuideActions dict={dict} />
              </div>
            </div>

            {!session ? (
              <div className="mt-4 rounded-card border border-dashed border-primary/30 bg-primary-tint/40 p-5">
                <p className="text-sm leading-6 text-ink/80">{dict.knowledge.heroNote}</p>
                <Link
                  href={{ pathname: '/login', query: { lang: locale, next: `/knowledge/${guide.id}` } }}
                  className="mt-3 inline-flex h-9 items-center rounded-input bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  {dict.knowledge.signInToSave}
                </Link>
              </div>
            ) : null}
          </aside>
        </article>
      </main>

      <SiteFooter dict={dict} />
    </div>
  );
}
