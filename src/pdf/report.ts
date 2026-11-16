import type { Column, Content as PdfContent, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Content } from '../content/schema';
import { radarSvg } from '../diagram/radar';
import { layoutDiagram } from '../diagram/layout';
import { DIAGRAM_COLORS, renderDiagramSvg } from '../diagram/svg';
import { buildArchitecture, describeDiagram } from '../engine/architecture';
import type { Answers } from '../engine/conditions';
import { buildDiagnostic, type DiagnosticResult } from '../engine/diagnostic';
import { fillTemplate, recoContext } from '../engine/recommend';
import { insightFor } from '../engine/scoring';

/**
 * Définition du rapport PDF (pdfmake), construite sans DOM : testable en Node, rendue dans le navigateur.
 * Mise en page A4, palette Lophius, Montserrat. Le vocabulaire technique y est autorisé, toujours expliqué.
 */
export interface ReportOptions {
  company?: string;
  date: Date;
  hourlyRate?: number;
  logoSvg: string;
  bookingUrl: string;
  contactUrl: string;
}

const C = {
  ...DIAGRAM_COLORS,
  text: '#000000',
  alert: '#B4532A',
  page: '#F1F3F4',
};
const A4_WIDTH = 595.28;
const MARGIN = 48;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;

/** Séparateur de milliers : espace insécable classique (l'espace fine U+202F n'existe pas dans la police embarquée). */
const formatNumber = (n: number, digits = 0) =>
  new Intl.NumberFormat('fr-BE', { maximumFractionDigits: digits }).format(n).replace(/\u202f/g, '\u00a0');
const formatDate = (d: Date) =>
  new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);

export function reportFileName(content: Content, company: string | undefined): string {
  const slug = (company ?? 'entreprise')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return fillTemplate(content.report.fileName, { company: slug || 'entreprise' });
}

export function buildReport(content: Content, answers: Answers, opts: ReportOptions): TDocumentDefinitions {
  const result = buildDiagnostic(
    content,
    answers,
    opts.hourlyRate === undefined ? {} : { hourlyRate: opts.hourlyRate },
  );
  const vars = {
    ...recoContext(content, answers).variables,
    company: opts.company ?? '',
    date: formatDate(opts.date),
  };
  const r = content.report;
  const tx = (key: string, extra: Record<string, string> = {}) =>
    fillTemplate(r.texts[key] ?? key, { ...vars, ...extra });
  const section = (key: string) => r.sections[key] ?? key;
  const companyLine = opts.company ? fillTemplate(r.preparedFor, vars) : fillTemplate(r.preparedForAnonymous, vars);

  return {
    pageSize: 'A4',
    pageMargins: [MARGIN, 64, MARGIN, 56],
    info: {
      title: `${r.title} — ${opts.company ?? ''}`.trim(),
      author: r.author,
      subject: r.title,
      creator: 'Lophius',
    },
    defaultStyle: { font: 'Montserrat', fontSize: 10, lineHeight: 1.3, color: C.text },
    styles: {
      eyebrow: { fontSize: 8, bold: true, color: C.blue, characterSpacing: 1.2 },
      h1: { fontSize: 22, color: C.text, margin: [0, 2, 0, 0] },
      h2: { fontSize: 16, bold: true, color: C.night, margin: [0, 0, 0, 8] },
      h3: { fontSize: 11, bold: true, color: C.night, margin: [0, 0, 0, 2] },
      muted: { color: C.muted },
      small: { fontSize: 8.5 },
    },
    header: (page) =>
      page === 1
        ? []
        : {
            columns: [
              { text: r.title, style: ['muted', 'small'] },
              { text: opts.company ?? '', style: ['muted', 'small'], alignment: 'right' },
            ],
            margin: [MARGIN, 28, MARGIN, 0],
          },
    footer: (page, pages) => ({
      columns: [
        { text: r.footer, style: ['muted', 'small'] },
        { text: `${page} / ${pages}`, style: ['muted', 'small'], alignment: 'right' },
      ],
      margin: [MARGIN, 20, MARGIN, 0],
    }),
    content: [
      ...synthesisPage(content, result, opts, { tx, section, companyLine }),
      ...dimensionsPage(content, result, { tx, section }),
      ...architecturePage(content, answers, { tx, section }),
      ...actionsPage(content, result, { tx, section }),
      ...nextStepsPage(content, result, opts, { tx, section, vars }),
    ],
  };
}

type Helpers = { tx: (k: string, extra?: Record<string, string>) => string; section: (k: string) => string };

function synthesisPage(
  content: Content,
  result: DiagnosticResult,
  opts: ReportOptions,
  h: Helpers & { companyLine: string },
): PdfContent[] {
  const { score, hiddenCost: cost } = result;
  return [
    {
      columns: [
        { svg: opts.logoSvg, width: 120 },
        { text: content.report.title.toUpperCase(), style: 'eyebrow', alignment: 'right', margin: [0, 10, 0, 0] },
      ],
      margin: [0, -24, 0, 18],
    },
    { text: h.section('synthesis').toUpperCase(), style: 'eyebrow' },
    { text: h.companyLine, style: 'muted', margin: [0, 2, 0, 10] },
    { text: h.tx('levelLine'), style: 'h1' },
    { text: score.level.label, fontSize: 28, color: C.blue, margin: [0, 0, 0, 8] },
    {
      columns: [
        {
          width: '*',
          stack: [
            {
              text: [
                { text: String(score.global), fontSize: 40, bold: true, color: C.blue },
                { text: ` ${h.tx('scoreUnit')}`, fontSize: 14, color: C.muted },
              ],
            },
            levelScale(content, score.level.id),
          ],
        },
        cost
          ? {
              width: 210,
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      stack: [
                        { text: h.tx('costLabel'), style: ['muted', 'small'] },
                        {
                          text: [
                            { text: `${formatNumber(cost.yearlyCost)} €`, fontSize: 24, bold: true, color: C.alert },
                            { text: ` ${h.tx('costUnit')}`, color: C.muted },
                          ],
                        },
                      ],
                      margin: [12, 10, 12, 10],
                    },
                  ],
                ],
              },
              layout: cardLayout(C.alert),
            }
          : { width: 0, text: '' },
      ],
      columnGap: 16,
      margin: [0, 0, 0, 10],
    },
    { text: result.summary, fontSize: 10.5, margin: [0, 0, 0, 4] },
    ...(score.cappedFrom
      ? [
          {
            text: `${h.tx('capped', { level: score.cappedFrom.label })} ${score.cappedFrom.blockedReason ?? ''}`,
            style: ['muted', 'small'],
          } as PdfContent,
        ]
      : []),
    { svg: radarSvg(content, score.dimensions), width: 250, alignment: 'center', margin: [0, 6, 0, 4] },
    { text: h.tx('quickWinsLabel'), style: 'h3', margin: [0, 2, 0, 4] },
    {
      ol: result.quickWins.map((q) => ({ text: q.title, margin: [0, 0, 0, 3] })),
      markerColor: C.blue,
    },
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: [
                h.tx('nextStepShort'),
                ' ',
                { text: h.tx('booking'), link: opts.bookingUrl, color: C.blue, bold: true, decoration: 'underline' },
              ],
              margin: [12, 8, 12, 8],
            },
          ],
        ],
      },
      layout: cardLayout(C.blue, C.soft),
      margin: [0, 8, 0, 0],
    },
  ];
}

function dimensionsPage(content: Content, result: DiagnosticResult, h: Helpers): PdfContent[] {
  const rows: PdfContent[] = content.dimensions.map((d) => {
    const score = result.score.dimensions.find((x) => x.id === d.id)?.score ?? null;
    const insight = insightFor(d, score);
    return {
      unbreakable: true,
      stack: [
        {
          columns: [
            {
              text: [
                { text: d.label, bold: true, color: C.night },
                { text: `  (${d.technicalLabel})`, style: 'muted', fontSize: 9 },
              ],
            },
            {
              text: score === null ? 'non évalué' : `${score}/100`,
              width: 70,
              alignment: 'right',
              bold: true,
              color: score === null ? C.muted : C.blue,
            },
          ],
        },
        scoreBar(score),
        ...(insight ? [{ text: insight, margin: [0, 2, 0, 2] } as PdfContent] : []),
        { text: d.technicalExplanation, style: ['muted', 'small'] },
      ],
      margin: [0, 0, 0, 14],
    };
  });
  return [
    { text: h.section('dimensions'), style: 'h2', pageBreak: 'before' },
    { text: h.tx('dimensionsIntro'), style: 'muted', margin: [0, 0, 0, 14] },
    ...rows,
  ];
}

function architecturePage(content: Content, answers: Answers, h: Helpers): PdfContent[] {
  const { today, target } = buildArchitecture(content, answers);
  const svg = (d: typeof today) =>
    renderDiagramSvg(layoutDiagram(d), { id: `pdf-${d.id}`, title: d.title, description: describeDiagram(content, d) });
  const column = (d: typeof today): Column => ({
    width: '*',
    stack: [
      { text: d.title, style: 'h3' },
      { text: d.subtitle, style: ['muted', 'small'], margin: [0, 0, 0, 6] },
      { svg: svg(d), width: (CONTENT_WIDTH - 16) / 2 },
    ],
  });
  return [
    { text: h.section('architecture'), style: 'h2', pageBreak: 'before' },
    { text: h.tx('architectureIntro'), style: 'muted', margin: [0, 0, 0, 10] },
    { columns: [column(today), column(target)], columnGap: 16 },
    {
      text: `${h.tx('legendAuto')}   ·   ${h.tx('legendManual')}`,
      style: ['muted', 'small'],
      alignment: 'center',
      margin: [0, 8, 0, 0],
    },
  ];
}

function actionsPage(content: Content, result: DiagnosticResult, h: Helpers): PdfContent[] {
  const cost = result.hiddenCost;
  const level = (v: string | undefined) => content.ui[`level_${v}`] ?? v ?? '';
  return [
    { text: h.section('cost'), style: 'h2', pageBreak: 'before' },
    ...(cost
      ? ([
          {
            text: [
              { text: `${formatNumber(cost.yearlyCost)} €`, fontSize: 22, bold: true, color: C.alert },
              { text: ` ${h.tx('costUnit')}`, color: C.muted },
            ],
          },
          {
            text: h.tx('costDetail', {
              hoursMonth: formatNumber(cost.hoursPerMonth, 1),
              months: String(content.settings.hiddenCost.monthsPerYear),
              rate: formatNumber(cost.hourlyRate),
              hours: formatNumber(cost.hoursPerYear),
            }),
            margin: [0, 2, 0, 2],
          },
          { text: h.tx('costNote'), style: ['muted', 'small'], margin: [0, 0, 0, 16] },
        ] as PdfContent[])
      : []),
    { text: h.section('quickWins'), style: 'h2' },
    ...result.quickWins.map((q, i): PdfContent => ({
      unbreakable: true,
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: `${i + 1}. ${q.title}`, style: 'h3' },
                { text: q.detail },
                {
                  text: `${h.tx('effort')} : ${level(q.effort)}   ·   ${h.tx('impact')} : ${level(q.impact)}`,
                  style: ['muted', 'small'],
                  margin: [0, 4, 0, 0],
                },
              ],
              margin: [12, 8, 12, 8],
            },
          ],
        ],
      },
      layout: cardLayout(C.border),
      margin: [0, 0, 0, 8],
    })),
    { text: h.section('roadmap'), style: 'h2', margin: [0, 12, 0, 8] },
    {
      columns: result.roadmap.map((phase, i) => ({
        width: '*',
        stack: [
          {
            canvas: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: (CONTENT_WIDTH - 24) / 3,
                h: 3,
                color: [C.blueLight, C.blue, C.night][i] ?? C.blue,
              },
            ],
          },
          { text: phase.label, bold: true, color: C.blue, margin: [0, 6, 0, 0] },
          { text: phase.title, style: 'h3' },
          {
            ul: phase.actions.map((a) => ({ text: a.title, margin: [0, 0, 0, 2] })),
            fontSize: 8.5,
            markerColor: C.blue,
          },
        ],
      })),
      columnGap: 12,
    },
  ];
}

function nextStepsPage(
  content: Content,
  result: DiagnosticResult,
  opts: ReportOptions,
  h: Helpers & { vars: Record<string, string> },
): PdfContent[] {
  const offers: PdfContent[] = result.offers.map((o) => ({
    unbreakable: true,
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: o.title, style: 'h3' },
              { text: o.why, color: C.blue, margin: [0, 0, 0, 4] },
              { text: o.summary, margin: [0, 0, 0, 4] },
              { ul: o.deliverables, fontSize: 9, markerColor: C.blue, margin: [0, 0, 0, 6] },
              {
                text: `${h.tx('duration')} : ${o.duration}   ·   ${h.tx('price')} : ${o.price}`,
                style: ['muted', 'small'],
              },
            ],
            margin: [12, 10, 12, 10],
          },
        ],
      ],
    },
    layout: cardLayout(C.blue),
    margin: [0, 0, 0, 8],
  }));
  const cheques: PdfContent[] = content.settings.features.chequesEntreprises
    ? [
        {
          text: [{ text: `${content.offers.cheques.title} : `, bold: true }, content.offers.cheques.text],
          style: 'small',
          margin: [0, 0, 0, 10],
        },
      ]
    : [];
  return [
    { text: h.section('nextSteps'), style: 'h2', pageBreak: 'before' },
    { text: h.tx('nextStepsIntro'), margin: [0, 0, 0, 12] },
    ...offers,
    ...cheques,
    {
      text: [
        { text: h.tx('booking'), link: opts.bookingUrl, color: C.blue, bold: true, decoration: 'underline' },
        '      ',
        { text: `${h.tx('contact')} : `, style: 'muted' },
        { text: opts.contactUrl.replace(/^https?:\/\//, ''), link: opts.contactUrl, color: C.blue },
      ],
      margin: [0, 4, 0, 0],
    },
    { text: h.section('glossary'), style: 'h3', margin: [0, 10, 0, 4] },
    ...content.report.glossary.map((g): PdfContent => ({
      text: [{ text: `${g.term} : `, bold: true, color: C.night }, fillTemplate(g.definition, h.vars)],
      margin: [0, 0, 0, 4],
      fontSize: 9,
      unbreakable: true,
    })),
    { text: content.report.author, bold: true, color: C.night, margin: [0, 12, 0, 0] },
    { text: content.report.disclaimer, style: ['muted', 'small'], margin: [0, 6, 0, 0] },
  ];
}

function levelScale(content: Content, currentId: string): PdfContent {
  return {
    text: content.levels.flatMap((l, i) => [
      ...(i > 0 ? [{ text: '  ›  ', color: C.border }] : []),
      { text: l.label, bold: l.id === currentId, color: l.id === currentId ? C.blue : C.muted },
    ]),
    fontSize: 9,
    margin: [0, 4, 0, 0],
  };
}

function scoreBar(score: number | null): PdfContent {
  const w = CONTENT_WIDTH;
  const filled = Math.max(0, Math.min(100, score ?? 0)) / 100;
  return {
    canvas: [
      { type: 'rect', x: 0, y: 0, w, h: 6, r: 3, color: C.soft },
      ...(filled > 0 ? [{ type: 'rect' as const, x: 0, y: 0, w: w * filled, h: 6, r: 3, color: C.blue }] : []),
    ],
    margin: [0, 3, 0, 3],
  };
}

/** Cadre de carte : bordure gauche colorée, fond optionnel. */
function cardLayout(accent: string, fill?: string) {
  return {
    hLineWidth: () => 0.6,
    vLineWidth: (i: number) => (i === 0 ? 3 : 0.6),
    hLineColor: () => C.border,
    vLineColor: (i: number) => (i === 0 ? accent : C.border),
    fillColor: () => fill ?? null,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  };
}
