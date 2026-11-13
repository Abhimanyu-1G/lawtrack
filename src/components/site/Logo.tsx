import type { SVGProps } from 'react';

/**
 * Original LawTrack mark: a simple balance beam inside a rounded square.
 * Deliberately invented — no emblem, seal or government motif (AGENTS.md §1.9).
 */
export function ScalesMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" />
      <path d="M20 9.5v20" />
      <path d="M12 13.5h16" />
      <path d="M12 13.5 8.5 21a3.5 3.5 0 0 0 7 0Z" />
      <path d="M28 13.5 24.5 21a3.5 3.5 0 0 0 7 0Z" />
      <path d="M15 30.5h10" />
    </svg>
  );
}

export function Wordmark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ScalesMark className={`h-8 w-8 ${inverted ? 'text-[#9DB0F5]' : 'text-primary'}`} />
      <span
        className={`font-serif text-[1.35rem] font-semibold leading-none tracking-tight ${
          inverted ? 'text-[#F5F2E8]' : 'text-ink'
        }`}
      >
        LawTrack
      </span>
    </span>
  );
}
