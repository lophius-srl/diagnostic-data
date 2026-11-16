import type { Content } from '../content/schema';
import type { DimensionScore } from '../engine/scoring';
import { DIAGRAM_COLORS, escapeXml } from './svg';

/** Géométrie du radar, partagée par la page (Preact) et le rapport PDF (SVG en chaîne). */
export const RADAR = { width: 400, height: 310, cx: 200, cy: 155, r: 95, labelRadius: 127, rings: [25, 50, 75, 100] };

/** Point sur l'axe `i` (sur n), à `value` % du rayon. Le premier axe pointe vers le haut. */
export function radarPoint(i: number, n: number, value: number): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
  const r = (RADAR.r * value) / 100;
  return [RADAR.cx + r * Math.cos(angle), RADAR.cy + r * Math.sin(angle)];
}

export const toPoints = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Radar en SVG autonome (couleurs en attributs), pour le rapport PDF. */
export function radarSvg(content: Content, scores: DimensionScore[]): string {
  const dims = content.dimensions;
  const n = dims.length;
  const valueOf = (id: string) => scores.find((s) => s.id === id)?.score ?? null;
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RADAR.width} ${RADAR.height}" width="${RADAR.width}" height="${RADAR.height}" font-family="Montserrat">`,
  ];
  for (const ring of RADAR.rings) {
    out.push(
      `<polygon points="${toPoints(dims.map((_, i) => radarPoint(i, n, ring)))}" fill="none" stroke="${DIAGRAM_COLORS.border}" stroke-width="1"/>`,
    );
  }
  dims.forEach((_, i) => {
    const [x, y] = radarPoint(i, n, 100);
    out.push(
      `<line x1="${RADAR.cx}" y1="${RADAR.cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${DIAGRAM_COLORS.border}" stroke-width="1"/>`,
    );
  });
  const shape = dims.map((d, i) => radarPoint(i, n, valueOf(d.id) ?? 0));
  out.push(
    `<polygon points="${toPoints(shape)}" fill="${DIAGRAM_COLORS.blueLight}" fill-opacity="0.2" stroke="${DIAGRAM_COLORS.blue}" stroke-width="2" stroke-linejoin="round"/>`,
  );
  shape.forEach(([x, y]) =>
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${DIAGRAM_COLORS.blue}"/>`),
  );
  dims.forEach((d, i) => {
    const [x, y] = radarPoint(i, n, (100 * RADAR.labelRadius) / RADAR.r);
    const value = valueOf(d.id);
    out.push(
      `<text x="${x.toFixed(1)}" y="${(y - 2).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="500" fill="${DIAGRAM_COLORS.night}">${escapeXml(d.label)}</text>`,
      `<text x="${x.toFixed(1)}" y="${(y + 14).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${value === null ? DIAGRAM_COLORS.muted : DIAGRAM_COLORS.blue}">${value === null ? '-' : value}</text>`,
    );
  });
  out.push('</svg>');
  return out.join('');
}
