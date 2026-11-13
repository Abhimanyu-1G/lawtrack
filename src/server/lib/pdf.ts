import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';

/**
 * Server-side legal-draft PDF (AGENTS.md §9).
 *
 * The document is typeset with bundled Noto fonts so English and Devanagari
 * text both render offline. Every page carries the draft id, version, approving
 * lawyer, approval date and the mandatory disclaimer, so a printed copy can
 * always be traced back to the reviewed version.
 *
 * Devanagari shaping: pdf-lib draws code points in logical order and does not
 * run a shaping engine, so conjuncts and pre-base matras are approximate. The
 * authoritative Hindi rendering is the print view (`/citizen/drafts/:id/print`),
 * which uses the browser's HarfBuzz-quality shaping; this is recorded in
 * docs/DECISIONS.md D-48.
 */

export interface DraftPdfInput {
  draftId: number;
  version: number;
  language: 'English' | 'Hindi';
  title: string;
  text: string;
  citizenName: string;
  lawyerName: string;
  approvedAt: string;
  disclaimer: string;
  /** Displayed in the footer, e.g. "10 Nov 2026". */
  approvedOn: string;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const BODY_SIZE = 11.5;
const LINE_HEIGHT = 17;
const FOOTER_SIZE = 8;

const DEVANAGARI = /[\u0900-\u097F]/;

function sanitize(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    // pdf-lib/WinAnsi-era fonts cannot draw emoji; keep the text readable.
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '');
}

export async function renderDraftPdf(input: DraftPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontsDir = path.join(process.cwd(), 'assets', 'fonts');
  const [latinBytes, latinBoldBytes] = await Promise.all([
    readFile(path.join(fontsDir, 'NotoSans-Regular.ttf')),
    readFile(path.join(fontsDir, 'NotoSans-Bold.ttf')),
  ]);
  const latin = await pdf.embedFont(latinBytes, { subset: true });
  const latinBold = await pdf.embedFont(latinBoldBytes, { subset: true });

  const needsDevanagari = DEVANAGARI.test(input.text) || input.language === 'Hindi';
  const devanagari = needsDevanagari
    ? await pdf.embedFont(
        await readFile(path.join(fontsDir, 'NotoSansDevanagari-Regular.ttf')),
        { subset: true },
      )
    : null;
  const devanagariBold = needsDevanagari
    ? await pdf.embedFont(await readFile(path.join(fontsDir, 'NotoSansDevanagari-Bold.ttf')), {
        subset: true,
      })
    : null;

  const bodyFontFor = (line: string) =>
    DEVANAGARI.test(line) && devanagari ? devanagari : latin;
  const headingFontFor = (line: string) =>
    DEVANAGARI.test(line) && devanagariBold ? devanagariBold : latinBold;

  const footerLines = [
    `LawTrack draft #${input.draftId} v${input.version} | Approved by ${input.lawyerName} on ${input.approvedOn}`,
    input.disclaimer,
    'Page {{page}} of {{total}}',
  ];

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  const drawFooter = (target: typeof page, pageNumber: number, totalPages: number): void => {
    const lines = footerLines.map((line) =>
      line.replace('{{page}}', String(pageNumber)).replace('{{total}}', String(totalPages)),
    );
    let y = MARGIN + 12;
    for (const line of lines.reverse()) {
      target.drawText(sanitize(line), {
        x: MARGIN,
        y,
        size: FOOTER_SIZE,
        font: latin,
        color: rgb(0.35, 0.35, 0.38),
        maxWidth: PAGE_WIDTH - MARGIN * 2,
      });
      y += FOOTER_SIZE + 3;
    }
  };

  const newPage = (): void => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN;
  };

  const writeLine = (line: string, options: { bold?: boolean } = {}): void => {
    if (cursorY < MARGIN + 60) newPage();
    const font = options.bold ? headingFontFor(line) : bodyFontFor(line);
    const size = options.bold ? BODY_SIZE + 1.5 : BODY_SIZE;

    if (line.trim().length === 0) {
      cursorY -= LINE_HEIGHT * 0.6;
      return;
    }

    // Word-wrap; Devanagari words are split on spaces only.
    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    const words = line.split(/\s+/).filter((word) => word.length > 0);
    let current = '';
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      const width = font.widthOfTextAtSize(sanitize(candidate), size);
      if (width <= maxWidth || current.length === 0) {
        current = candidate;
        continue;
      }
      page.drawText(sanitize(current), {
        x: MARGIN,
        y: cursorY,
        size,
        font,
        color: rgb(0.09, 0.09, 0.1),
      });
      cursorY -= LINE_HEIGHT;
      if (cursorY < MARGIN + 60) newPage();
      current = word;
    }

    if (current.length > 0) {
      page.drawText(sanitize(current), {
        x: MARGIN,
        y: cursorY,
        size,
        font,
        color: rgb(0.09, 0.09, 0.1),
      });
      cursorY -= LINE_HEIGHT;
    }
  };

  writeLine('LawTrack', { bold: true });
  writeLine(input.title, { bold: true });
  writeLine(`${input.citizenName} | Draft #${input.draftId} | Version ${input.version}`);
  writeLine('');

  for (const line of sanitize(input.text).split('\n')) {
    const trimmed = line.trimEnd();
    const isHeading =
      trimmed.length > 0 &&
      trimmed.length <= 90 &&
      (trimmed === trimmed.toUpperCase() ||
        /^(COMPLAINT|LEGAL NOTICE|APPLICATION|शिकायत|कानूनी नोटिस|सूचना)/.test(trimmed));
    writeLine(trimmed, { bold: isHeading });
  }

  const pages = pdf.getPages();
  pages.forEach((target, index) => {
    drawFooter(target, index + 1, pages.length);
  });

  return pdf.save();
}
