import type { ArchDiagram, ArchNode } from '../engine/architecture';

/** Mise en page verticale (haut → bas) pensée pour un téléphone : 2 colonnes au plus. */
export const LAYOUT = {
  width: 360,
  margin: 12,
  gap: 10,
  rowGap: 38,
  captionHeight: 22,
  framePadding: 8,
  padX: 10,
  padY: 9,
  labelSize: 13,
  detailSize: 11,
  lineHeight: 1.3,
  /** Largeur moyenne d'un caractère Montserrat, en fraction de la taille de police (estimation prudente). */
  charWidth: 0.6,
} as const;

export interface PlacedNode extends ArchNode {
  x: number;
  y: number;
  w: number;
  h: number;
  labelLines: string[];
  detailLines: string[];
  noteLines: string[];
  rowIndex: number;
}

export interface PlacedFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  rowIndex: number;
  /** Légende (cadre en pointillés) ; sans légende, simple cadre de regroupement. */
  caption?: string;
}

export interface PlacedEdge {
  /** Tracé orthogonal : descente, bus horizontal à mi-hauteur, descente vers la cible. */
  points: [number, number][];
  style: 'auto' | 'manual';
}

/** Tracé en angle droit entre deux points (droit si les x coïncident). */
export function orthogonal(x1: number, y1: number, x2: number, y2: number): [number, number][] {
  if (Math.abs(x1 - x2) < 0.5)
    return [
      [x1, y1],
      [x1, y2],
    ];
  const mid = (y1 + y2) / 2;
  return [
    [x1, y1],
    [x1, mid],
    [x2, mid],
    [x2, y2],
  ];
}

export interface DiagramLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  frames: PlacedFrame[];
  edges: PlacedEdge[];
}

/** Coupe un texte en lignes qui tiennent dans `maxWidth` (estimation de largeur, sans DOM). */
export function wrap(text: string, maxWidth: number, fontSize: number): string[] {
  const maxChars = Math.max(6, Math.floor(maxWidth / (fontSize * LAYOUT.charWidth)));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function layoutDiagram(diagram: ArchDiagram): DiagramLayout {
  const L = LAYOUT;
  const inner = L.width - 2 * L.margin;
  const colW = (inner - L.gap) / 2;
  const nodes: PlacedNode[] = [];
  const frames: PlacedFrame[] = [];
  let y = L.margin;

  diagram.rows.forEach((row, rowIndex) => {
    const perLine = row.fullWidth || row.nodes.length === 1 ? 1 : 2;
    const framed = row.caption !== undefined || row.nodes.length > perLine;
    const frameTop = y;
    const p = L.framePadding;
    if (framed) y += row.caption ? L.captionHeight : p;
    for (let start = 0; start < row.nodes.length; start += perLine) {
      const line = row.nodes.slice(start, start + perLine);
      const w = row.fullWidth ? inner : perLine === 1 ? Math.min(inner, 230) : colW;
      const measured = line.map((n) => measure(n, w));
      const h = Math.max(...measured.map((m) => m.h));
      const lineWidth = line.length * w + (line.length - 1) * L.gap;
      let x = L.margin + (inner - lineWidth) / 2;
      line.forEach((n, i) => {
        nodes.push({ ...n, ...measured[i]!, x, y, w, h, rowIndex });
        x += w + L.gap;
      });
      y += h + L.gap;
    }
    y -= L.gap;
    if (framed) {
      y += p;
      frames.push({
        x: L.margin - p,
        y: frameTop,
        w: inner + 2 * p,
        h: y - frameTop,
        rowIndex,
        ...(row.caption !== undefined && { caption: row.caption }),
      });
    }
    y += L.rowGap;
  });

  const height = y - L.rowGap + L.margin;
  return { width: L.width, height, nodes, frames, edges: placeEdges(diagram, nodes, frames) };
}

function measure(n: ArchNode, w: number) {
  const L = LAYOUT;
  const textW = w - 2 * L.padX;
  const labelLines = wrap(n.label, textW, L.labelSize);
  const detailLines = n.detail ? wrap(n.detail, textW, L.detailSize) : [];
  const noteLines = n.notes.flatMap((note) => wrap(`• ${note}`, textW, L.detailSize));
  const h =
    2 * L.padY +
    labelLines.length * L.labelSize * L.lineHeight +
    (detailLines.length + noteLines.length) * L.detailSize * L.lineHeight +
    (detailLines.length + noteLines.length > 0 ? 3 : 0);
  return { labelLines, detailLines, noteLines, h: Math.ceil(h) };
}

/**
 * Liens entre rangées voisines. Une rangée encadrée (plusieurs lignes ou légende) est reliée par son cadre :
 * un seul trait en sort ou y entre, et aucun trait ne traverse une boîte.
 */
function placeEdges(diagram: ArchDiagram, nodes: PlacedNode[], frames: PlacedFrame[]): PlacedEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const frameOf = new Map(frames.map((f) => [f.rowIndex, f]));
  const edges = new Map<string, PlacedEdge>();

  for (const e of diagram.edges) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from || !to) continue;
    const fromFrame = frameOf.get(from.rowIndex);
    const toFrame = frameOf.get(to.rowIndex);

    let x1 = from.x + from.w / 2;
    let x2 = to.x + to.w / 2;
    const y1 = fromFrame ? fromFrame.y + fromFrame.h : from.y + from.h;
    const y2 = toFrame ? toFrame.y : to.y;
    if (fromFrame) x1 = toFrame ? LAYOUT.width / 2 : x2;
    if (toFrame) x2 = fromFrame ? LAYOUT.width / 2 : x1;
    if (!fromFrame && !toFrame) {
      if (from.w > to.w * 1.5) x1 = x2;
      else if (to.w > from.w * 1.5) x2 = x1;
    }

    const key = `${fromFrame ? `row${from.rowIndex}` : from.id}->${toFrame ? `row${to.rowIndex}` : to.id}`;
    const existing = edges.get(key);
    if (existing) {
      if (e.style === 'manual') existing.style = 'manual';
      continue;
    }
    edges.set(key, { points: orthogonal(x1, y1, x2, y2), style: e.style });
  }
  return [...edges.values()];
}
