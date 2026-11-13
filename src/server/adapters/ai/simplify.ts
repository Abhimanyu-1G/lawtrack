import 'server-only';

/**
 * Offline "re-simplify" fallback for the curator console (Phase 3).
 *
 * AGENTS.md §10 requires the product to work without an AI key. This provider
 * never invents facts: it only tidies spacing and swaps a short list of formal
 * connectors for plainer words. The result is a suggestion — a curator must
 * read it and press Save before anything changes. The UI labels it "Demo AI
 * mode". A Gemini-backed provider can replace this function later behind the
 * same interface.
 */

export interface SimplifyResult {
  text: string;
  model: string;
  demo: boolean;
}

export const DEMO_SIMPLIFY_MODEL = 'demo-simplify-v1';

const REPLACEMENTS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\bshall be entitled to\b/gi, replacement: 'has a right to' },
  { pattern: /\bshall\b/gi, replacement: 'must' },
  { pattern: /\bprior to\b/gi, replacement: 'before' },
  { pattern: /\bin the event of\b/gi, replacement: 'if there is' },
  { pattern: /\bwith respect to\b/gi, replacement: 'about' },
  { pattern: /\bnotwithstanding\b/gi, replacement: 'despite' },
  { pattern: /\bpursuant to\b/gi, replacement: 'under' },
  { pattern: /\bin order to\b/gi, replacement: 'to' },
  { pattern: /\bcommence\b/gi, replacement: 'start' },
  { pattern: /\bterminate\b/gi, replacement: 'end' },
  { pattern: /\butilise\b/gi, replacement: 'use' },
  { pattern: /\butilize\b/gi, replacement: 'use' },
  { pattern: /\bapproximately\b/gi, replacement: 'about' },
];

function capitaliseFirst(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function tidyParagraph(paragraph: string): string {
  let text = paragraph.replace(/\s+/g, ' ').trim();
  for (const rule of REPLACEMENTS) text = text.replace(rule.pattern, rule.replacement);
  return capitaliseFirst(text);
}

export function resimplifyText(text: string): SimplifyResult {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(tidyParagraph)
    .filter((paragraph) => paragraph.length > 0);

  return {
    text: paragraphs.join('\n\n'),
    model: DEMO_SIMPLIFY_MODEL,
    demo: true,
  };
}
