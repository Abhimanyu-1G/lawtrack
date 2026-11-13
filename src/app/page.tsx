import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SkipLink } from '@/components/site/SkipLink';
import { getDictionary, htmlLang } from '@/i18n';
import { pageLocale } from '@/server/http/pageLocale';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

interface HomePageProps {
  searchParams: Promise<{ lang?: string }>;
}

const demoAccounts = [
  'citizen@lawtrack.demo',
  'lawyer@lawtrack.demo',
  'curator@lawtrack.demo',
  'admin@lawtrack.demo',
  'apimanager@lawtrack.demo',
];

const showDemoAccounts = process.env.NODE_ENV !== 'production';

const featureIcons = [
  // Open book
  'M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23V5.5Zm16 0A2.5 2.5 0 0 0 17.5 3H12v18h5.5A2.5 2.5 0 0 1 20 23V5.5Z',
  // Document with a pen
  'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h4',
  // Calendar with a check
  'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 9 2.5 2.5L16 11',
];

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const locale = await pageLocale(params.lang);
  const dict = getDictionary(locale);

  const features = [
    {
      title: dict.landing.primaryFeatureTitle,
      body: dict.landing.primaryFeatureBody,
      icon: featureIcons[0],
    },
    {
      title: dict.landing.draftFeatureTitle,
      body: dict.landing.draftFeatureBody,
      icon: featureIcons[1],
    },
    {
      title: dict.landing.trackFeatureTitle,
      body: dict.landing.trackFeatureBody,
      icon: featureIcons[2],
    },
  ];

  const steps = [
    { title: dict.landing.stepOneTitle, body: dict.landing.stepOneBody },
    { title: dict.landing.stepTwoTitle, body: dict.landing.stepTwoBody },
    { title: dict.landing.stepThreeTitle, body: dict.landing.stepThreeBody },
  ];

  return (
    <div lang={htmlLang(locale)}>
      <SkipLink label={dict.common.skipToContent} />
      <SiteHeader locale={locale} dict={dict} pathname="/" />

      <main id="main-content">
        {/* Hero ------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-shell px-5 pt-10 sm:px-8 sm:pt-14">
          <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#2A4BC4] to-[#182E80] px-6 py-12 text-[#FBF9F1] shadow-lift sm:px-12 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10 sm:h-80 sm:w-80"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full border border-white/10"
            />

            <div className="relative max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C7D2F9]">
                {dict.landing.eyebrow}
              </p>
              <h1 className="mt-5 font-serif text-[2.1rem] font-semibold leading-[1.12] tracking-tight text-[#FBF9F1] sm:text-5xl lg:text-[3.4rem]">
                {dict.landing.title}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#DCE3FB] sm:text-lg sm:leading-8">
                {dict.landing.subtitle}
              </p>
              <Link
                href={{ pathname: '/knowledge', query: { lang: locale } }}
                className="mt-8 inline-flex h-11 items-center gap-2 rounded-input bg-[#FBF9F1] px-5 text-sm font-semibold text-[#1F3A9E] transition-colors hover:bg-white"
              >
                {dict.landing.browseGuides}
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
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {showDemoAccounts ? (
          <section className="mx-auto w-full max-w-shell px-5 pt-6 sm:px-8">
            <div className="flex flex-col gap-3 rounded-card border border-dashed border-primary/30 bg-primary-tint/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">{dict.landing.demoTitle}</p>
                <p className="mt-1 text-xs leading-5 text-ink/80">
                  {dict.landing.demoNote.replace('{{password}}', 'Demo1234')}
                </p>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {demoAccounts.map((email) => (
                  <li
                    key={email}
                    className="rounded-pill border border-primary/25 bg-surface px-2 py-1 font-mono text-[0.7rem] text-primary"
                  >
                    {email}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* Features --------------------------------------------------- */}
        <section
          aria-label={dict.landing.howTitle}
          className="mx-auto w-full max-w-shell px-5 pt-14 sm:px-8"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-card border border-line bg-surface p-6 shadow-soft transition-shadow duration-200 hover:shadow-lift"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-card bg-primary-tint text-primary">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={feature.icon} />
                  </svg>
                </span>
                <h2 className="mt-5 text-lg font-semibold">{feature.title}</h2>
                <p className="mt-2 text-[0.95rem] leading-6 text-muted">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works ----------------------------------------------- */}
        <section className="mx-auto w-full max-w-shell px-5 pt-16 sm:px-8">
          <h2 className="text-2xl sm:text-3xl">{dict.landing.howTitle}</h2>
          <ol className="mt-8 grid gap-6 border-t border-line pt-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="font-serif text-2xl font-semibold leading-none text-primary"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[0.95rem] leading-6 text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Trust ------------------------------------------------------ */}
        <section className="mx-auto w-full max-w-shell px-5 pt-16 sm:px-8">
          <div className="grid gap-6 rounded-card border border-line bg-surface p-7 shadow-soft sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-primary-tint text-primary">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3Z" />
                <path d="m9 12 2.2 2.2L15.5 10" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl">{dict.landing.trustTitle}</h2>
              <p className="mt-2 max-w-3xl text-[0.95rem] leading-7 text-muted">{dict.landing.trustBody}</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter dict={dict} />
    </div>
  );
}
