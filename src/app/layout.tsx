import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, Noto_Sans_Devanagari, Noto_Serif_Devanagari, Source_Serif_4 } from 'next/font/google';

import '../styles/globals.css';

/**
 * Typography (AGENTS.md §15): Source Serif 4 for headings, Inter for body,
 * Noto Devanagari faces for Hindi. Exposed as CSS variables so Tailwind's
 * `font-sans` / `font-serif` stacks pick them up.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari', 'latin'],
  display: 'swap',
  variable: '--font-devanagari',
});

const notoSerifDevanagari = Noto_Serif_Devanagari({
  subsets: ['devanagari', 'latin'],
  display: 'swap',
  variable: '--font-devanagari-heading',
});

export const metadata: Metadata = {
  title: {
    default: 'LawTrack — Indian law in plain language',
    template: '%s · LawTrack',
  },
  description:
    'LawTrack explains Indian law in plain English and Hindi, helps you prepare complaints, RTI applications and legal notices for lawyer review, and tracks court cases by CNR number.',
  applicationName: 'LawTrack',
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF9F1' },
    { media: '(prefers-color-scheme: dark)', color: '#121214' },
  ],
};

/**
 * Applies the saved (or system) colour theme before first paint to avoid a
 * flash of the wrong theme. Kept inline and tiny; CSP allows inline scripts.
 */
const themeBootstrap = `(function(){try{var stored=localStorage.getItem('lawtrack-theme');var dark=stored?stored==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(dark){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en-IN"
      dir="ltr"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${sourceSerif.variable} ${notoSansDevanagari.variable} ${notoSerifDevanagari.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink">{children}</body>
    </html>
  );
}
