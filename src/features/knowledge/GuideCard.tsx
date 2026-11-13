import Link from 'next/link';

import { categoryLabel, type Dictionary, type Locale } from '../../i18n';
import type { GuideDto } from '../../server/modules/guides/service';
import { formatGuideDate } from './format';
import { HighlightedText } from './HighlightedText';

/**
 * Guide summary card used on the Knowledge Hub and the citizen dashboard.
 * Every card is a real link to a published guide — no placeholders.
 */
export function GuideCard({
  guide,
  locale,
  dict,
  highlight,
}: {
  guide: GuideDto;
  locale: Locale;
  dict: Dictionary;
  highlight?: string;
}) {
  const preview = guide.summary.split('\n\n')[0] ?? guide.summary;
  const href = { pathname: `/knowledge/${guide.id}`, query: { lang: locale } };

  return (
    <article className="flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-soft transition-shadow duration-200 hover:shadow-lift">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-pill bg-primary-tint px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
          {categoryLabel(dict, guide.category)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-success">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-success" />
          {dict.knowledge.verifiedBadge}
        </span>
      </div>

      <h2 className="mt-3.5 text-lg leading-snug">
        <Link
          href={href}
          className="rounded-input underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          <HighlightedText text={guide.title} term={highlight} />
        </Link>
      </h2>

      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">
        <HighlightedText text={preview} term={highlight} />
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs text-muted">
        <span>{dict.knowledge.updated.replace('{{date}}', formatGuideDate(guide.lastUpdated, locale))}</span>
        <Link
          href={href}
          aria-label={`${dict.knowledge.readGuide}: ${guide.title}`}
          className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
        >
          {dict.knowledge.readGuide}
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
    </article>
  );
}
