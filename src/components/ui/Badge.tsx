import type { ReactNode } from 'react';

/**
 * Muted status colour + icon + label, never colour alone (AGENTS.md §15).
 * `neutral` is for metadata such as language or version.
 */

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-canvas text-ink',
  primary: 'border-primary/30 bg-primary-tint text-primary',
  success: 'border-success/30 bg-success-tint text-success',
  warning: 'border-warning/30 bg-warning-tint text-warning',
  danger: 'border-danger/30 bg-danger-tint text-danger',
};

const ICONS: Record<BadgeTone, string | null> = {
  neutral: null,
  primary: null,
  success: 'M5 12l4 4L19 6',
  warning: 'M12 8v5m0 3v.01M10.3 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z',
  danger: 'M12 8v5m0 3v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const icon = ICONS[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold leading-none ${TONES[tone]} ${className}`}
    >
      {icon ? (
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
          <path d={icon} />
        </svg>
      ) : null}
      {children}
    </span>
  );
}

export type StatusPillTone = 'neutral' | 'success' | 'warning' | 'danger';

export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: StatusPillTone;
}) {
  return <Badge tone={tone}>{label}</Badge>;
}
