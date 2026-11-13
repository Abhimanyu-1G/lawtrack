import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SkipLink } from '@/components/site/SkipLink';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GuideCard } from '@/features/knowledge/GuideCard';
import { categoryLabel, getDictionary, htmlLang, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { getPageSession } from '@/server/http/pageAuth';
import { pageLocale } from '@/server/http/pageLocale';
import { getGuidesService } from '@/server/modules/guides';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Knowledge Hub',
  description:
    'Curator-verified explanations of Indian law in plain English and Hindi: traffic, tenancy, consumer rights, RTI, cyber fraud, property and more.',
};

interface KnowledgePageProps {
  searchParams: Promise<{ lang?: string; q?: string; category?: string; page?: string }>;
}

/** Build a `/knowledge` link while preserving the active filters. */
function hubHref(
  locale: Locale,
  filters: { q?: string; category?: string; page?: number },
): { pathname: string; query: Record<string, string> } {
  const query: Record<string, string> = { lang: locale };
  if (filters.q) query.q = filters.q;
  if (filters.category) query.category = filters.category;
  if (filters.page && filters.page > 1) query.page = String(filters.page);
  return { pathname: '/knowledge', query };
}

function RepositoryIcon() {
  return (
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
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23V5.5Zm16 0A2.5 2.5 0 0 0 17.5 3H12v18h5.5A2.5 2.5 0 0 1 20 23V5.5Z" />
    </svg>
  );
}

export default async function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const params = await searchParams;
  const locale = await pageLocale(params.lang);
  const dict = getDictionary(locale);
  const session = await getPageSession();
  const language = locale === 'hi' ? 'Hindi' : 'English';
  const query = params.q?.trim() || undefined;
  const category = params.category?.trim() || undefined;

  const service = getGuidesService();
  const [result, categories] = await Promise.all([
    service.listPublic({
      query,
      category,
      language,
      page: params.page,
      pageSize: 12,
    }),
    service.categories(language),
  ]);

  const hasFilters = Boolean(query || category);
  const pageHref = (page: number) => hubHref(locale, { q: query, category, page });

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

      <main id="main-content">
        {/* Heading + search ------------------------------------------------ */}
        <section className="mx-auto w-full max-w-shell px-5 pt-10 sm:px-8 sm:pt-14">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {dict.knowledge.eyebrow}
            </p>
            <h1 className="mt-3 text-3xl leading-tight sm:text-4xl lg:text-[2.75rem]">
              {dict.knowledge.title}
            </h1>
            <p className="mt-4 max-w-2xl text-[0.98rem] leading-7 text-muted">
              {dict.knowledge.subtitle}
            </p>
          </div>

          <form action="/knowledge" method="get" role="search" className="mt-8 max-w-2xl">
            <input type="hidden" name="lang" value={locale} />
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <label htmlFor="knowledge-q" className="text-sm font-medium text-ink">
              {dict.knowledge.searchLabel}
            </label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input
                id="knowledge-q"
                name="q"
                type="search"
                defaultValue={params.q ?? ''}
                placeholder={dict.knowledge.searchPlaceholder}
                className="h-11 w-full rounded-input border border-line bg-surface px-3.5 text-[0.95rem] text-ink shadow-sm outline-none transition-colors placeholder:text-muted/70 focus:border-primary"
              />
              <button
                type="submit"
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-input bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-pressed"
              >
                {dict.knowledge.searchAction}
              </button>
            </div>
          </form>

          {session ? (
            <p className="mt-4 text-xs leading-5 text-muted">{dict.knowledge.heroNote}</p>
          ) : (
            <p className="mt-4 text-xs leading-5 text-muted">
              {dict.knowledge.heroNote}{' '}
              <Link
                href={{ pathname: '/login', query: { lang: locale, next: '/knowledge' } }}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {dict.knowledge.signInToSave}
              </Link>
            </p>
          )}
        </section>

        {/* Category tiles -------------------------------------------------- */}
        <section className="mx-auto w-full max-w-shell px-5 pt-12 sm:px-8">
          <h2 className="text-xl sm:text-2xl">{dict.knowledge.categoriesHeading}</h2>
          <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <li>
              <Link
                href={hubHref(locale, { q: query })}
                aria-current={!category ? 'page' : undefined}
                className={`flex h-full min-h-20 flex-col justify-between gap-2 rounded-card border p-3.5 transition-colors ${
                  !category
                    ? 'border-primary bg-primary-tint text-primary'
                    : 'border-line bg-surface text-ink hover:border-primary/40 hover:text-primary'
                }`}
              >
                <RepositoryIcon />
                <span className="text-sm font-semibold leading-tight">
                  {dict.knowledge.allCategories}
                </span>
              </Link>
            </li>
            {categories.map((entry) => {
              const active = category === entry.category;
              return (
                <li key={entry.category}>
                  <Link
                    href={hubHref(locale, { q: query, category: entry.category })}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-full min-h-20 flex-col justify-between gap-2 rounded-card border p-3.5 transition-colors ${
                      active
                        ? 'border-primary bg-primary-tint text-primary'
                        : 'border-line bg-surface text-ink hover:border-primary/40 hover:text-primary'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <RepositoryIcon />
                      <span className="text-xs font-semibold text-muted">{entry.count}</span>
                    </span>
                    <span className="text-sm font-semibold leading-tight">
                      {categoryLabel(dict, entry.category)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Results --------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-shell px-5 pt-12 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl">{dict.knowledge.resultsHeading}</h2>
              <p className="mt-1 text-sm text-muted">
                {query
                  ? dict.knowledge.searchFor.replace('{{query}}', query)
                  : category
                    ? dict.knowledge.filterCategory.replace('{{category}}', categoryLabel(dict, category))
                    : dict.knowledge.resultsCount.replace('{{count}}', String(result.total))}
              </p>
            </div>
            {hasFilters ? (
              <Link
                href={hubHref(locale, {})}
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {dict.knowledge.clearFilters}
              </Link>
            ) : null}
          </div>

          {result.items.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                title={dict.knowledge.noResultsTitle}
                body={dict.knowledge.noResultsBody}
                action={
                  <Link href={hubHref(locale, {})} className={buttonClasses('primary', 'sm')}>
                    {dict.knowledge.clearFilters}
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((guide) => (
                <GuideCard key={guide.id} guide={guide} locale={locale} dict={dict} highlight={query} />
              ))}
            </div>
          )}

          {result.totalPages > 1 ? (
            <nav
              aria-label={dict.knowledge.resultsHeading}
              className="mt-8 flex items-center justify-between gap-3"
            >
              {result.page > 1 ? (
                <Link
                  href={pageHref(result.page - 1)}
                  className="inline-flex h-10 items-center rounded-input border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary"
                >
                  ← {dict.knowledge.previous}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted">
                {dict.knowledge.pageOf
                  .replace('{{page}}', String(result.page))
                  .replace('{{total}}', String(result.totalPages))}
              </span>
              {result.page < result.totalPages ? (
                <Link
                  href={pageHref(result.page + 1)}
                  className="inline-flex h-10 items-center rounded-input border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {dict.knowledge.next} →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </main>

      <SiteFooter dict={dict} />
    </div>
  );
}
