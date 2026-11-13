import Link from 'next/link';

import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GuideStatusBadge } from '@/features/curator/GuideStatusBadge';
import { formatGuideDate } from '@/features/knowledge/format';
import { categoryLabel, getDictionary, type Dictionary, type Locale } from '@/i18n';
import { ROLE_HOME, type GuideStatus } from '@/shared/enums';
import { parseGuideStatus } from '@/shared/guideFilters';
import { requirePageRole } from '@/server/http/pageAuth';
import { getGuidesService } from '@/server/modules/guides';
import type { GuideDto } from '@/server/modules/guides/service';

export const dynamic = 'force-dynamic';

interface CuratorGuidesPageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

function listHref(
  filters: { status?: GuideStatus; q?: string; page?: number },
): { pathname: string; query: Record<string, string> } {
  const query: Record<string, string> = {};
  if (filters.status) query.status = filters.status;
  if (filters.q) query.q = filters.q;
  if (filters.page && filters.page > 1) query.page = String(filters.page);
  return { pathname: '/curator/guides', query };
}

function GuideRow({
  guide,
  locale,
  dict,
}: {
  guide: GuideDto;
  locale: Locale;
  dict: Dictionary;
}) {
  const editHref = `/curator/guides/${guide.id}`;

  return (
    <tr className="align-top">
      <td className="px-4 py-3.5">
        <Link
          href={editHref}
          className="font-medium text-ink underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          {guide.title}
        </Link>
        <p className="mt-1 line-clamp-1 max-w-md text-xs text-muted">
          {guide.summary.split('\n\n')[0]}
        </p>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted">
        {categoryLabel(dict, guide.category)}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted">
        {guide.language === 'Hindi' ? dict.common.hindi : dict.common.english}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5">
        <GuideStatusBadge status={guide.status} dict={dict} />
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted">
        {formatGuideDate(guide.lastUpdated, locale)}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-right">
        <Link
          href={editHref}
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          {dict.curator.open}
        </Link>
      </td>
    </tr>
  );
}

function GuideCard({
  guide,
  locale,
  dict,
}: {
  guide: GuideDto;
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <GuideStatusBadge status={guide.status} dict={dict} />
        <span className="text-xs text-muted">{categoryLabel(dict, guide.category)}</span>
        <span className="text-xs text-muted">·</span>
        <span className="text-xs text-muted">
          {guide.language === 'Hindi' ? dict.common.hindi : dict.common.english}
        </span>
      </div>
      <h3 className="mt-2 text-base leading-snug">
        <Link
          href={`/curator/guides/${guide.id}`}
          className="underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          {guide.title}
        </Link>
      </h3>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{formatGuideDate(guide.lastUpdated, locale)}</span>
        <Link
          href={`/curator/guides/${guide.id}`}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {dict.curator.open}
        </Link>
      </div>
    </li>
  );
}

export default async function CuratorGuidesPage({ searchParams }: CuratorGuidesPageProps) {
  const params = await searchParams;
  const session = await requirePageRole('Curator', ROLE_HOME.Curator);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);
  const status = parseGuideStatus(params.status);
  const query = params.q?.trim() || undefined;

  const service = getGuidesService();
  const [result, counts] = await Promise.all([
    service.listForCurator({ status, query, page: params.page, pageSize: 20 }),
    service.statusCounts(),
  ]);
  const total = counts.Draft + counts.Valid + counts['Requires AI Update'];

  const tabs: { label: string; status?: GuideStatus; count: number }[] = [
    { label: dict.curator.allGuides, count: total },
    { label: dict.curator.statusDraft, status: 'Draft', count: counts.Draft },
    { label: dict.curator.statusValid, status: 'Valid', count: counts.Valid },
    {
      label: dict.curator.statusRequires,
      status: 'Requires AI Update',
      count: counts['Requires AI Update'],
    },
  ];

  const pageHref = (page: number) => listHref({ status, q: query, page });
  const list = result;

  return (
    <div className="max-w-5xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {dict.roles.Curator}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{dict.curator.title}</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">{dict.curator.subtitle}</p>

      {/* Filter tabs ------------------------------------------------------ */}
      <div className="mt-7 flex flex-wrap items-center gap-1.5" role="group" aria-label={dict.curator.filterStatus}>
        {tabs.map((tab) => {
          const active = status === tab.status;
          return (
            <Link
              key={tab.label}
              href={listHref({ status: tab.status, q: query })}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex h-9 items-center gap-2 rounded-pill border px-3.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary-tint text-primary'
                  : 'border-line bg-surface text-ink hover:border-primary/40 hover:text-primary'
              }`}
            >
              {tab.label}
              <span className={`text-xs ${active ? 'text-primary' : 'text-muted'}`}>{tab.count}</span>
            </Link>
          );
        })}
      </div>

      <form action="/curator/guides" method="get" role="search" className="mt-4 max-w-xl">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="curator-q" className="text-sm font-medium text-ink">
          {dict.curator.searchLabel}
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="curator-q"
            name="q"
            type="search"
            defaultValue={params.q ?? ''}
            placeholder={dict.curator.searchPlaceholder}
            className="h-11 w-full rounded-input border border-line bg-surface px-3.5 text-[0.95rem] text-ink shadow-sm outline-none transition-colors placeholder:text-muted/70 focus:border-primary"
          />
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-input border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-primary/40 hover:text-primary"
          >
            {dict.curator.searchAction}
          </button>
        </div>
      </form>

      <p className="mt-6 text-sm text-muted">
        {dict.curator.resultsCount.replace('{{count}}', String(list.total))}
      </p>

      {list.items.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={dict.curator.emptyTitle}
            body={dict.curator.emptyBody}
            action={
              <Link href={listHref({})} className={buttonClasses('primary', 'sm')}>
                {dict.curator.allGuides}
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="mt-3 space-y-3 md:hidden">
            {list.items.map((guide) => (
              <GuideCard key={guide.id} guide={guide} locale={locale} dict={dict} />
            ))}
          </ul>

          {/* Desktop table */}
          <div className="mt-3 hidden overflow-x-auto rounded-card border border-line bg-surface shadow-soft md:block">
            <table className="min-w-full text-left">
              <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {dict.curator.colGuide}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {dict.curator.colCategory}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {dict.curator.colLanguage}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {dict.curator.colStatus}
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {dict.curator.colUpdated}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    {dict.curator.colAction}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.items.map((guide) => (
                  <GuideRow key={guide.id} guide={guide} locale={locale} dict={dict} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {list.totalPages > 1 ? (
        <nav aria-label={dict.curator.title} className="mt-6 flex items-center justify-between gap-3">
          {list.page > 1 ? (
            <Link
              href={pageHref(list.page - 1)}
              className="inline-flex h-10 items-center rounded-input border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary"
            >
              ← {dict.knowledge.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted">
            {dict.knowledge.pageOf
              .replace('{{page}}', String(list.page))
              .replace('{{total}}', String(list.totalPages))}
          </span>
          {list.page < list.totalPages ? (
            <Link
              href={pageHref(list.page + 1)}
              className="inline-flex h-10 items-center rounded-input border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary"
            >
              {dict.knowledge.next} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
