import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { describe, expect, it } from 'vitest';
import { buildReport, reportFileName } from '../src/pdf/report';
import { renderReportNode } from '../src/pdf/render-node';
import { content, profile, profiles, simulatedAnswers } from './helpers';

const logoSvg = readFileSync(join(process.cwd(), 'public', 'brand', 'logo.svg'), 'utf8');
const options = {
  company: 'Négoce Dupont SRL',
  date: new Date('2026-11-16T10:00:00Z'),
  logoSvg,
  bookingUrl: 'https://agenda.example/lophius',
  contactUrl: 'https://www.lophius.be/#contact',
};

/** Tous les textes d'une définition pdfmake (hors SVG), pour les contrôles de contenu. */
function texts(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => texts(n, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) if (k !== 'svg' && k !== 'link') texts(v, out);
  }
  return out;
}

const allText = (def: TDocumentDefinitions) => texts(def.content).join('\n');
const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;

describe('contenu du rapport PDF', () => {
  const def = buildReport(content, profile('negoce-12.yaml').answers, options);
  const text = allText(def);

  it('contient les sections attendues dans l’ordre', () => {
    const order = ['synthesis', 'dimensions', 'architecture', 'cost', 'quickWins', 'roadmap', 'nextSteps'].map(
      (k) => content.report.sections[k]!,
    );
    const lower = text.toLowerCase();
    const positions = order.map((title) => lower.indexOf(title.toLowerCase()));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('reprend le niveau, le score, le coût caché, les quick wins et les outils de la PME', () => {
    expect(text).toContain('Structuré');
    expect(text).toContain('30');
    expect(text).toContain('9\u00a0900 €');
    expect(text).toContain('Relier votre rapport Excel le plus long à WinBooks');
    expect(text).toContain('Préparé pour Négoce Dupont SRL, le 16 novembre 2026');
  });

  it('explique chaque terme technique (une explication par axe, glossaire)', () => {
    for (const d of content.dimensions) {
      expect(text).toContain(d.technicalLabel);
      expect(text).toContain(d.technicalExplanation);
    }
    for (const g of content.report.glossary) expect(text).toContain(g.term);
  });

  it('inclut le logo, le radar et les deux schémas en SVG', () => {
    const svgs = JSON.stringify(def.content).match(/<svg /g) ?? [];
    expect(svgs.length).toBe(4);
  });

  it('pointe vers la prise de rendez-vous', () => {
    expect(JSON.stringify(def.content)).toContain('https://agenda.example/lophius');
  });

  it('n’affiche les chèques-entreprises que si l’option est activée', () => {
    expect(text).not.toContain(content.offers.cheques.text);
    const withCheques = structuredClone(content);
    withCheques.settings.features.chequesEntreprises = true;
    expect(allText(buildReport(withCheques, profile('negoce-12.yaml').answers, options))).toContain(
      content.offers.cheques.text,
    );
  });

  it('fonctionne sans nom d’entreprise (lien partagé)', () => {
    const anonymous = allText(
      buildReport(content, profile('negoce-12.yaml').answers, { ...options, company: undefined }),
    );
    expect(anonymous).toContain('Établi le 16 novembre 2026');
  });

  it('respecte les règles de crédibilité : pas de Power BI sans Microsoft 365', () => {
    for (const answers of simulatedAnswers(300, 5)) {
      const t = allText(buildReport(content, answers, options));
      if (answers.microsoft !== 'oui') expect(t).not.toMatch(/Power BI|OneDrive|SharePoint/);
      expect(t).not.toMatch(/\{\w+\}/);
    }
  });

  it('nom de fichier sans accents ni caractères spéciaux', () => {
    expect(reportFileName(content, 'Négoce & Fils / Liège')).toBe('Diagnostic-data-Negoce-Fils-Liege.pdf');
    expect(reportFileName(content, undefined)).toBe('Diagnostic-data-entreprise.pdf');
  });
});

describe('police embarquée', () => {
  it('chaque caractère du rapport existe dans Montserrat (pas de carré vide)', () => {
    const require = createRequire(import.meta.url);
    const fontkit = require('@foliojs-fork/fontkit') as {
      openSync(path: string): { hasGlyphForCodePoint(c: number): boolean };
    };
    const fontDir = join(process.cwd(), 'node_modules', '@fontsource', 'montserrat', 'files');
    const fonts = [400, 700].map((w) => fontkit.openSync(join(fontDir, `montserrat-latin-${w}-normal.woff`)));
    const missing = new Set<string>();
    for (const answers of [...profiles.map((p) => p.answers), ...simulatedAnswers(200, 9)]) {
      const def = buildReport(content, answers, options);
      // Textes dessinés des SVG (sans <title>/<desc>, qui ne sont pas imprimés).
      const svgs = JSON.stringify(def.content).replace(/<(title|desc)[^>]*>.*?<\/\1>/g, '');
      const svgText = (svgs.match(/>([^<>]+)</g) ?? []).join('');
      for (const ch of allText(def) + svgText) {
        const cp = ch.codePointAt(0)!;
        if (cp > 31 && cp !== 0x2028 && !fonts.every((f) => f.hasGlyphForCodePoint(cp)))
          missing.add(`U+${cp.toString(16)} « ${ch} »`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('rendu réel du PDF', () => {
  it('produit un PDF valide de 5 pages pour les 3 profils', async () => {
    for (const p of profiles) {
      const pdf = await renderReportNode(content, p.answers, { company: 'PME', date: options.date });
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pageCount(pdf), p.file).toBe(5);
    }
  });

  it('garde 5 pages, sans débordement, sur 150 parcours simulés', async () => {
    const counts = new Map<number, number>();
    for (const answers of simulatedAnswers(150, 3)) {
      const pdf = await renderReportNode(content, answers, {
        company: 'Une entreprise au nom assez long SRL',
        date: options.date,
      });
      const n = pageCount(pdf);
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({ 5: 150 });
  }, 120_000);
});
