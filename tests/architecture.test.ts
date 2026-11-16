import { describe, expect, it } from 'vitest';
import { layoutDiagram, wrap, LAYOUT, type DiagramLayout } from '../src/diagram/layout';
import { escapeXml, renderDiagramSvg } from '../src/diagram/svg';
import { selected, type Answers } from '../src/engine/conditions';
import { buildArchitecture, describeDiagram, type ArchDiagram } from '../src/engine/architecture';
import { content, profile, profiles, simulatedAnswers } from './helpers';

const SIMULATED = simulatedAnswers(2000, 7);
const nodesOf = (d: ArchDiagram) => d.rows.flatMap((r) => r.nodes);

describe('modèle des schémas', () => {
  it('ne montre que les outils cochés', () => {
    for (const answers of SIMULATED) {
      const chosen = new Set(selected(answers, 'outils'));
      const { today, target } = buildArchitecture(content, answers);
      for (const d of [today, target]) {
        for (const n of nodesOf(d)) if (n.toolId) expect(chosen.has(n.toolId), `${n.label} non coché`).toBe(true);
      }
      expect(nodesOf(today).some((n) => n.kind === 'excel')).toBe(chosen.has('excel'));
      expect(nodesOf(today).some((n) => n.toolId === 'fiduciaire')).toBe(chosen.has('fiduciaire'));
    }
  });

  it('l’outil de tableau de bord suit la réponse Microsoft', () => {
    for (const answers of SIMULATED) {
      const labels = nodesOf(buildArchitecture(content, answers).target)
        .map((n) => n.label)
        .join(' ');
      if (answers.microsoft === 'oui') expect(labels).toMatch(/Power BI/);
      else expect(labels).not.toMatch(/Power BI|Microsoft/);
    }
  });

  it('la cible contient toujours outils → synchronisation → base centrale → usages → équipe', () => {
    for (const answers of SIMULATED.slice(0, 300)) {
      const { target } = buildArchitecture(content, answers);
      const kinds = target.rows.map((r) => r.nodes[0]?.kind);
      expect(kinds.slice(1, 3)).toEqual(['layer', 'base']);
      expect(target.rows.at(-1)?.nodes[0]?.kind).toBe('people');
      expect(target.edges.every((e) => e.style === 'auto')).toBe(true);
    }
  });

  it('aujourd’hui : les flux vers Excel sont manuels', () => {
    const { today } = buildArchitecture(content, profile('negoce-12.yaml').answers);
    expect(today.edges.filter((e) => e.to === 'excel').every((e) => e.style === 'manual')).toBe(true);
    expect(nodesOf(today).find((n) => n.id === 'excel')?.notes).toContain('tenus par une seule personne');
  });

  it('e-commerce : signale les outils qui ne se parlent pas et montre la fiduciaire', () => {
    const { today } = buildArchitecture(content, profile('ecommerce-6.yaml').answers);
    expect(today.rows[0]?.caption).toBe('Des outils qui ne se parlent pas');
    expect(nodesOf(today).find((n) => n.toolId === 'fiduciaire')?.detail).toBe('partenaire externe');
  });

  it('chaque lien relie deux nœuds existants', () => {
    for (const answers of SIMULATED) {
      const { today, target } = buildArchitecture(content, answers);
      for (const d of [today, target]) {
        const ids = new Set(nodesOf(d).map((n) => n.id));
        for (const e of d.edges) expect(ids.has(e.from) && ids.has(e.to)).toBe(true);
      }
    }
  });
});

describe('mise en page des schémas (lisible sur téléphone)', () => {
  const layouts: DiagramLayout[] = SIMULATED.flatMap((a) => {
    const { today, target } = buildArchitecture(content, a);
    return [layoutDiagram(today), layoutDiagram(target)];
  });

  it('aucune boîte ne déborde de la largeur', () => {
    for (const l of layouts) {
      for (const n of l.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x + n.w).toBeLessThanOrEqual(LAYOUT.width);
      }
    }
  });

  it('aucune boîte n’en chevauche une autre', () => {
    for (const l of layouts) {
      for (let i = 0; i < l.nodes.length; i++) {
        for (let j = i + 1; j < l.nodes.length; j++) {
          const a = l.nodes[i]!;
          const b = l.nodes[j]!;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap, `${a.label} / ${b.label}`).toBe(false);
        }
      }
    }
  });

  it('aucun trait ne traverse une boîte', () => {
    for (const l of layouts) {
      for (const e of l.edges) {
        for (let k = 1; k < e.points.length; k++) {
          const [x1, y1] = e.points[k - 1]!;
          const [x2, y2] = e.points[k]!;
          for (const n of l.nodes) {
            const crosses =
              Math.min(x1, x2) < n.x + n.w - 1 &&
              Math.max(x1, x2) > n.x + 1 &&
              Math.min(y1, y2) < n.y + n.h - 1 &&
              Math.max(y1, y2) > n.y + 1;
            expect(crosses, `trait à travers « ${n.label} »`).toBe(false);
          }
        }
      }
    }
  });

  it('les traits descendent toujours (lecture de haut en bas)', () => {
    for (const l of layouts) for (const e of l.edges) expect(e.points.at(-1)![1]).toBeGreaterThan(e.points[0]![1]);
  });

  it('chaque ligne de texte tient dans sa boîte', () => {
    for (const l of layouts) {
      for (const n of l.nodes) {
        const max = n.w - 2 * LAYOUT.padX;
        for (const line of n.labelLines)
          expect(line.length * LAYOUT.labelSize * LAYOUT.charWidth, line).toBeLessThanOrEqual(max + 12);
      }
    }
  });
});

describe('rendu SVG', () => {
  it('produit un SVG autonome, accessible, avec les outils du profil', () => {
    for (const p of profiles) {
      const { today } = buildArchitecture(content, p.answers);
      const svg = renderDiagramSvg(layoutDiagram(today), {
        id: 'x',
        title: today.title,
        description: describeDiagram(content, today),
      });
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).toContain('<title id="x-t">');
      expect(svg).not.toMatch(/class=/);
    }
    const svg = renderDiagramSvg(layoutDiagram(buildArchitecture(content, profile('negoce-12.yaml').answers).today), {
      id: 'n',
      title: 't',
      description: 'd',
    });
    expect(svg).toContain('WinBooks');
  });

  it('échappe les caractères spéciaux', () => {
    expect(escapeXml(`<a & "b" 'c'>`)).toBe('&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;');
  });

  it('coupe les textes trop longs en plusieurs lignes', () => {
    expect(wrap('Tableau de bord Looker Studio', 140, 13).length).toBeGreaterThan(1);
    expect(wrap('Odoo', 140, 13)).toEqual(['Odoo']);
  });

  it('décrit le schéma en texte (lecteurs d’écran et PDF)', () => {
    const answers: Answers = profile('services-40.yaml').answers;
    expect(describeDiagram(content, buildArchitecture(content, answers).today)).toMatch(
      /Odoo → Fichiers Excel \(à la main\)/,
    );
  });
});
