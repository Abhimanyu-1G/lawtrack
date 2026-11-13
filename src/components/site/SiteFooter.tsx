import Link from 'next/link';

import type { Dictionary } from '../../i18n';
import { Wordmark } from './Logo';

/**
 * Footer is a coal band in both themes with ivory text and royal-blue links.
 * The disclaimer is mandatory on every page (AGENTS.md §1.9).
 */
export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer className="mt-20 bg-[#17171A] text-[#F5F2E8]">
      <div className="mx-auto w-full max-w-shell px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-4">
            <Wordmark inverted />
            <p className="text-sm leading-6 text-[#C9C6BC]">{dict.common.footerDisclaimer}</p>
          </div>

          <div className="space-y-3 text-sm">
            <Link
              href="/api/health"
              className="inline-flex items-center gap-2 rounded-input text-[#9DB0F5] underline-offset-4 hover:underline"
            >
              <span className="inline-block h-2 w-2 rounded-pill bg-[#7FD3A8]" aria-hidden="true" />
              {dict.common.systemStatus}
            </Link>
            <p className="max-w-xs text-xs leading-5 text-[#8E8B84]">{dict.common.footerNote}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
