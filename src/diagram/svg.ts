import { LAYOUT, type DiagramLayout, type PlacedNode } from './layout';

/**
 * Rendu SVG en chaîne, sans DOM ni CSS externe (couleurs en attributs) :
 * le même rendu sert à la page de résultats et au rapport PDF.
 */
export const DIAGRAM_COLORS = {
  blue: '#324B84',
  blueLight: '#4669B9',
  night: '#1C2A4A',
  soft: '#E8EDF7',
  border: '#C9D1E0',
  muted: '#5B6270',
  white: '#FFFFFF',
} as const;

const FONT = "Montserrat, 'Segoe UI', Arial, sans-serif";

export function escapeXml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
}

const STYLE: Record<PlacedNode['kind'], { fill: string; stroke: string; text: string; sub: string; dashed?: boolean }> =
  {
    tool: {
      fill: DIAGRAM_COLORS.white,
      stroke: DIAGRAM_COLORS.border,
      text: DIAGRAM_COLORS.night,
      sub: DIAGRAM_COLORS.muted,
    },
    external: {
      fill: DIAGRAM_COLORS.white,
      stroke: DIAGRAM_COLORS.border,
      text: DIAGRAM_COLORS.night,
      sub: DIAGRAM_COLORS.muted,
      dashed: true,
    },
    excel: {
      fill: DIAGRAM_COLORS.soft,
      stroke: DIAGRAM_COLORS.blueLight,
      text: DIAGRAM_COLORS.night,
      sub: DIAGRAM_COLORS.muted,
    },
    layer: {
      fill: DIAGRAM_COLORS.soft,
      stroke: DIAGRAM_COLORS.blueLight,
      text: DIAGRAM_COLORS.blue,
      sub: DIAGRAM_COLORS.muted,
    },
    base: { fill: DIAGRAM_COLORS.blue, stroke: DIAGRAM_COLORS.blue, text: DIAGRAM_COLORS.white, sub: '#D9E1F2' },
    output: {
      fill: DIAGRAM_COLORS.white,
      stroke: DIAGRAM_COLORS.blue,
      text: DIAGRAM_COLORS.night,
      sub: DIAGRAM_COLORS.muted,
    },
    people: { fill: DIAGRAM_COLORS.night, stroke: DIAGRAM_COLORS.night, text: DIAGRAM_COLORS.white, sub: '#D9E1F2' },
  };

export interface SvgOptions {
  id: string;
  title: string;
  description: string;
  /** Ajoute des classes d'animation (page web uniquement). */
  animated?: boolean;
}

export function renderDiagramSvg(layout: DiagramLayout, opts: SvgOptions): string {
  const L = LAYOUT;
  const id = escapeXml(opts.id);
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${Math.ceil(layout.height)}" width="${layout.width}" height="${Math.ceil(layout.height)}" role="img" aria-labelledby="${id}-t ${id}-d" font-family="${FONT}">`,
    `<title id="${id}-t">${escapeXml(opts.title)}</title><desc id="${id}-d">${escapeXml(opts.description)}</desc>`,
    `<defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${DIAGRAM_COLORS.blue}"/></marker>`,
    `<marker id="${id}-arrow-m" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${DIAGRAM_COLORS.muted}"/></marker></defs>`,
  );

  for (const f of layout.frames) {
    out.push(
      f.caption
        ? `<rect x="${r(f.x)}" y="${r(f.y)}" width="${r(f.w)}" height="${r(f.h)}" rx="16" fill="none" stroke="${DIAGRAM_COLORS.muted}" stroke-width="1" stroke-dasharray="4 4"/>` +
            `<text x="${L.width / 2}" y="${r(f.y + 15)}" text-anchor="middle" font-size="11" font-style="italic" fill="${DIAGRAM_COLORS.muted}">${escapeXml(f.caption)}</text>`
        : `<rect x="${r(f.x)}" y="${r(f.y)}" width="${r(f.w)}" height="${r(f.h)}" rx="16" fill="${DIAGRAM_COLORS.soft}" fill-opacity="0.45" stroke="${DIAGRAM_COLORS.border}" stroke-width="1"/>`,
    );
  }

  layout.edges.forEach((e, i) => {
    const manual = e.style === 'manual';
    const cls = opts.animated ? ` class="diagram-edge" style="animation-delay:${200 + i * 40}ms"` : '';
    const pts = e.points.map(([x, y], j) => `${r(x)},${r(j === e.points.length - 1 ? y - 2 : y)}`).join(' ');
    out.push(
      `<polyline${cls} points="${pts}" fill="none" stroke="${manual ? DIAGRAM_COLORS.muted : DIAGRAM_COLORS.blue}" stroke-width="${manual ? 1.5 : 2}" stroke-linejoin="round"${manual ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#${id}-arrow${manual ? '-m' : ''})"/>`,
    );
  });

  layout.nodes.forEach((n, i) => {
    const s = STYLE[n.kind];
    const cls = opts.animated ? ` class="diagram-node" style="animation-delay:${i * 60}ms"` : '';
    const rx = n.kind === 'layer' || n.kind === 'base' ? 14 : 12;
    out.push(`<g${cls}>`);
    out.push(
      `<rect x="${r(n.x)}" y="${r(n.y)}" width="${r(n.w)}" height="${n.h}" rx="${rx}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.2"${s.dashed ? ' stroke-dasharray="4 3"' : ''}/>`,
    );
    const cx = n.x + n.w / 2;
    let ty = n.y + L.padY + L.labelSize;
    for (const line of n.labelLines) {
      out.push(textLine(cx, ty, line, L.labelSize, s.text, 700));
      ty += L.labelSize * L.lineHeight;
    }
    if (n.detailLines.length + n.noteLines.length > 0) ty += 2;
    for (const line of [...n.detailLines, ...n.noteLines]) {
      out.push(textLine(cx, ty - 2, line, L.detailSize, s.sub, 500));
      ty += L.detailSize * L.lineHeight;
    }
    out.push('</g>');
  });

  out.push('</svg>');
  return out.join('');
}

function textLine(x: number, y: number, text: string, size: number, fill: string, weight: number): string {
  return `<text x="${r(x)}" y="${r(y)}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(text)}</text>`;
}

const r = (n: number) => Math.round(n * 10) / 10;
