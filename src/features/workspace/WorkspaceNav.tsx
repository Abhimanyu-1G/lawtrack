'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Role-aware workspace navigation. Rendered once for the desktop sidebar and
 * once for the mobile bottom bar. It is a client component only so the current
 * destination can be marked with `aria-current`; access control remains in the
 * server layout.
 */

export type WorkspaceNavKind = 'overview' | 'book' | 'review' | 'chat' | 'draft' | 'case';

export interface WorkspaceNavItem {
  href: string;
  label: string;
  kind: WorkspaceNavKind;
}

const ICON_PATHS: Record<WorkspaceNavKind, string> = {
  overview:
    'M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4Zm9 0A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4Zm-9 9A1.5 1.5 0 0 1 5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4Zm9 0A1.5 1.5 0 0 1 14.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4Z',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23V5.5Zm16 0A2.5 2.5 0 0 0 17.5 3H12v18h5.5A2.5 2.5 0 0 1 20 23V5.5Z',
  review: 'M9 3h6l1 2h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3l1-2Zm3 6v5m0 3v.01',
  chat: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6Z',
  draft: 'M7 3h7l4 4v14H7V3Zm7 0v4h4M10 12h5M10 16h5',
  case: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm2 7h4v4H7v-4Z',
};

function isActive(pathname: string, item: WorkspaceNavItem, homeHref: string): boolean {
  if (item.href === homeHref) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function WorkspaceNav({
  items,
  homeHref,
  label,
  variant,
}: {
  items: WorkspaceNavItem[];
  homeHref: string;
  label: string;
  variant: 'side' | 'bottom';
}) {
  const pathname = usePathname() ?? '';

  if (variant === 'bottom') {
    return (
      <nav
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex w-full max-w-shell">
          {items.map((item) => {
            const active = isActive(pathname, item, homeHref);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors ${
                  active ? 'text-primary' : 'text-muted hover:text-ink'
                }`}
              >
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
                  <path d={ICON_PATHS[item.kind]} />
                </svg>
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label={label} className="hidden w-52 shrink-0 lg:block">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item, homeHref);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-2.5 rounded-input px-3 text-sm transition-colors ${
                  active
                    ? 'bg-primary-tint font-semibold text-primary'
                    : 'font-medium text-ink hover:bg-primary-tint/60 hover:text-primary'
                }`}
              >
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
                  <path d={ICON_PATHS[item.kind]} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
