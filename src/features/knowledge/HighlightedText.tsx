import type { ReactNode } from 'react';

/**
 * Search-result highlighting. The term is escaped before it becomes a regular
 * expression, and matches are wrapped in `<mark>` so sighted users see them and
 * screen readers still receive the full sentence.
 */
export function HighlightedText({ text, term }: { text: string; term?: string }): ReactNode {
  const needle = term?.trim();
  if (!needle) return text;

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return parts.map((part, index) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={index} className="rounded-sm bg-primary-tint px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}
