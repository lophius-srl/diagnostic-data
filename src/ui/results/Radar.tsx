import { content, t } from '../../content';
import type { DimensionScore } from '../../engine/scoring';
import { useRevealOnScroll } from '../motion';

// Libellés centrés sous/au-dessus de chaque sommet : la largeur reste contenue sur téléphone.
const W = 400;
const H = 310;
const CX = W / 2;
const CY = 155;
const R = 95;
const LABEL_RADIUS = 127;
const RINGS = [25, 50, 75, 100];

/** Coordonnées d'un point sur l'axe `i` (sur n), à `value` % du rayon. Le premier axe pointe vers le haut. */
export function radarPoint(i: number, n: number, value: number): [number, number] {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
  const r = (R * value) / 100;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

const toPoints = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export function Radar({ scores }: { scores: DimensionScore[] }) {
  const [ref, visible] = useRevealOnScroll<HTMLDivElement>();
  const dims = content.dimensions;
  const n = dims.length;
  const valueOf = (id: string) => scores.find((s) => s.id === id)?.score ?? null;
  const shape = dims.map((d, i) => radarPoint(i, n, valueOf(d.id) ?? 0));
  const description = dims.map((d) => `${d.label} ${valueOf(d.id) ?? t('results_not_evaluated')}`).join(', ');

  return (
    <div class="radar" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('results_radar_label', { values: description })}>
        <g class="radar-grid">
          {RINGS.map((ring) => (
            <polygon key={ring} points={toPoints(dims.map((_, i) => radarPoint(i, n, ring)))} />
          ))}
          {dims.map((d, i) => {
            const [x, y] = radarPoint(i, n, 100);
            return <line key={d.id} x1={CX} y1={CY} x2={x} y2={y} />;
          })}
        </g>
        <g class={visible ? 'radar-shape is-visible' : 'radar-shape'} style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <polygon points={toPoints(shape)} />
          {shape.map(([x, y], i) => (
            <circle key={dims[i]!.id} cx={x} cy={y} r="3.5" />
          ))}
        </g>
        {dims.map((d, i) => {
          const [x, y] = radarPoint(i, n, (100 * LABEL_RADIUS) / R);
          const value = valueOf(d.id);
          return (
            <text key={d.id} x={x} y={y} text-anchor="middle" class="radar-label" aria-hidden="true">
              <tspan x={x} dy="-0.2em">
                {d.label}
              </tspan>
              <tspan x={x} dy="1.25em" class={value === null ? 'radar-value is-muted' : 'radar-value'}>
                {value === null ? '–' : value}
              </tspan>
            </text>
          );
        })}
      </svg>
    </div>
  );
}
