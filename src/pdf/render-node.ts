import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Content } from '../content/schema';
import type { Answers } from '../engine/conditions';
import { buildReport } from './report';

/** Rendu du rapport en Node (tests, script de relecture). Le navigateur utilise download.ts. */
export async function renderReportNode(
  content: Content,
  answers: Answers,
  opts: { company?: string; date?: Date } = {},
): Promise<Buffer> {
  const require = createRequire(import.meta.url);
  const PdfPrinter = require('pdfmake/src/printer') as new (fonts: unknown) => {
    createPdfKitDocument(doc: unknown): NodeJS.ReadableStream & { end(): void };
  };
  const fontDir = join(process.cwd(), 'node_modules', '@fontsource', 'montserrat', 'files');
  const font = (w: number) => join(fontDir, `montserrat-latin-${w}-normal.woff`);
  const printer = new PdfPrinter({
    Montserrat: { normal: font(400), bold: font(700), italics: font(400), bolditalics: font(700) },
  });
  const definition = buildReport(content, answers, {
    ...(opts.company !== undefined && { company: opts.company }),
    date: opts.date ?? new Date(),
    logoSvg: readFileSync(join(process.cwd(), 'public', 'brand', 'logo.svg'), 'utf8'),
    bookingUrl: content.settings.links.contact,
    contactUrl: content.settings.links.contact,
  });
  const doc = printer.createPdfKitDocument(definition);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
