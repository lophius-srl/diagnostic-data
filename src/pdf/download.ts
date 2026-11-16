import pdfMake from 'pdfmake/build/pdfmake';
import font400 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url';
import font700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff?url';
import { content } from '../content';
import type { Answers } from '../engine/conditions';
import { buildReport, reportFileName } from './report';

/**
 * Génère et télécharge le rapport PDF dans le navigateur (aucune donnée envoyée à un tiers).
 * Ce module, pdfmake compris, n'est chargé qu'au clic sur « Télécharger le rapport PDF ».
 */
export async function downloadReport(
  answers: Answers,
  opts: { company?: string; hourlyRate?: number; bookingUrl: string },
): Promise<void> {
  const [regular, bold, logoSvg] = await Promise.all([
    fetchBase64(font400),
    fetchBase64(font700),
    fetch(`${import.meta.env.BASE_URL}brand/logo.svg`).then((r) => r.text()),
  ]);
  const vfs = { 'Montserrat-400.woff': regular, 'Montserrat-700.woff': bold };
  const fonts = {
    Montserrat: {
      normal: 'Montserrat-400.woff',
      bold: 'Montserrat-700.woff',
      italics: 'Montserrat-400.woff',
      bolditalics: 'Montserrat-700.woff',
    },
  };
  const definition = buildReport(content, answers, {
    ...(opts.company && { company: opts.company }),
    ...(opts.hourlyRate !== undefined && { hourlyRate: opts.hourlyRate }),
    date: new Date(),
    logoSvg,
    bookingUrl: opts.bookingUrl,
    contactUrl: content.settings.links.contact,
  });
  pdfMake.createPdf(definition, undefined, fonts, vfs).download(reportFileName(content, opts.company));
}

async function fetchBase64(url: string): Promise<string> {
  const buffer = await (await fetch(url)).arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
