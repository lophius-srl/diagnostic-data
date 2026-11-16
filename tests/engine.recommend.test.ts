import { describe, expect, it } from 'vitest';
import { selected, type Answers } from '../src/engine/conditions';
import { buildDiagnostic, type DiagnosticResult } from '../src/engine/diagnostic';
import { fillTemplate, joinNames } from '../src/engine/recommend';
import { content, profile, profiles, simulatedAnswers } from './helpers';

const SIMULATED = simulatedAnswers(3000);

function allTexts(d: DiagnosticResult): string[] {
  return [
    ...d.quickWins.flatMap((a) => [a.title, a.detail]),
    ...d.roadmap.flatMap((p) => p.actions.flatMap((a) => [a.title, a.detail])),
    ...d.offers.flatMap((o) => [o.title, o.summary, o.why, ...o.deliverables]),
    d.summary,
  ];
}

const toolOptionIds = (answers: Answers) => new Set(selected(answers, 'outils'));

describe('règles de crédibilité des recommandations (3 000 parcours simulés)', () => {
  it('ne cite jamais un outil que la PME n’a pas coché', () => {
    for (const answers of SIMULATED) {
      const chosen = toolOptionIds(answers);
      const text = allTexts(buildDiagnostic(content, answers)).join(' \n ');
      for (const tool of content.tools) {
        // « Excel / Google Sheets » : chaque nom est vérifié séparément.
        for (const name of tool.name.split(' / ')) {
          const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
          if (pattern.test(text)) expect(chosen.has(tool.id), `${name} cité sans être coché`).toBe(true);
        }
      }
    }
  });

  it('ne recommande jamais Power BI ni un produit Microsoft sans Microsoft 365', () => {
    for (const answers of SIMULATED) {
      const text = allTexts(buildDiagnostic(content, answers)).join(' ');
      if (answers.microsoft !== 'oui') expect(text).not.toMatch(/Power BI|Microsoft|OneDrive|SharePoint/);
      if (answers.microsoft === 'eviter') expect(text).not.toMatch(/Microsoft/);
    }
  });

  it('ne propose Google Drive qu’à une PME qui travaille avec Google', () => {
    for (const answers of SIMULATED) {
      const text = allTexts(buildDiagnostic(content, answers)).join(' ');
      if (answers.microsoft !== 'google') expect(text).not.toMatch(/Google Drive/);
    }
  });

  it('propose toujours exactement 3 quick wins distincts, avec effort et impact', () => {
    for (const answers of SIMULATED) {
      const wins = buildDiagnostic(content, answers).quickWins;
      expect(wins).toHaveLength(3);
      expect(new Set(wins.map((w) => w.id)).size).toBe(3);
      for (const w of wins) expect(w.effort && w.impact && w.dimension).toBeTruthy();
    }
  });

  it('ne laisse aucun texte à trous non rempli', () => {
    for (const answers of SIMULATED) {
      for (const text of allTexts(buildDiagnostic(content, answers))) expect(text).not.toMatch(/\{\w+\}/);
    }
  });

  it('ne propose un quick win que si sa condition est remplie', () => {
    for (const answers of SIMULATED) {
      const ids = buildDiagnostic(content, answers).quickWins.map((w) => w.id);
      if (ids.includes('qw_sauvegarde')) expect(['quelques_uns', 'oui']).toContain(answers.ordinateur);
      if (ids.includes('qw_documenter_excel')) expect(['complique', 'perdus']).toContain(answers.personne_excel);
      if (ids.includes('qw_relier_ventes_compta')) expect(['parfois', 'souvent']).toContain(answers.recopie);
      if (ids.includes('qw_pieces_fiduciaire'))
        expect(['journee', 'jours', 'semaine']).toContain(answers.temps_tableaux);
    }
  });

  it('feuille de route : 3 phases, sans doublon, dans les limites de la config', () => {
    for (const answers of SIMULATED.slice(0, 500)) {
      const phases = buildDiagnostic(content, answers).roadmap;
      expect(phases.map((p) => p.label)).toEqual(['30 jours', '60 jours', '90 jours']);
      const ids = phases.flatMap((p) => p.actions.map((a) => a.id));
      expect(new Set(ids).size).toBe(ids.length);
      phases.forEach((p, i) => expect(p.actions.length).toBeLessThanOrEqual(content.recommendations.roadmap[i]!.max));
      expect(phases.every((p) => p.actions.length > 0)).toBe(true);
    }
  });

  it('recommande 1 ou 2 forfaits', () => {
    for (const answers of SIMULATED) {
      const n = buildDiagnostic(content, answers).offers.length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(content.offers.maxRecommended);
    }
  });

  it('ignore une réponse devenue invisible (ex. outil décoché après coup)', () => {
    const answers: Answers = { ...profile('negoce-12.yaml').answers, outils: ['winbooks'] };
    const text = allTexts(buildDiagnostic(content, answers)).join(' ');
    expect(text).not.toMatch(/Excel/);
  });
});

describe('les 3 profils reçoivent des recommandations crédibles et différentes', () => {
  const results = Object.fromEntries(profiles.map((p) => [p.file, buildDiagnostic(content, p.answers)]));

  it('négoce : nomme WinBooks et traite la dépendance au fichier Excel', () => {
    const r = results['negoce-12.yaml']!;
    expect(r.quickWins.some((w) => w.title.includes('WinBooks'))).toBe(true);
    expect(r.quickWins.map((w) => w.id)).toContain('qw_documenter_excel');
    expect(r.offers[0]?.id).toBe('centralisation');
  });

  it('services : marge par client et par produit, Power BI (Microsoft 365)', () => {
    const r = results['services-40.yaml']!;
    expect(r.quickWins.map((w) => w.title).join()).toMatch(/client et par produit/);
    expect(allTexts(r).join()).toMatch(/Power BI/);
    expect(r.offers[0]?.id).toBe('tableau_bord');
  });

  it('e-commerce : Shopify vers Yuki, jamais Microsoft', () => {
    const r = results['ecommerce-6.yaml']!;
    expect(r.quickWins.map((w) => w.title)).toContain('Envoyer automatiquement les ventes Shopify vers Yuki');
    expect(allTexts(r).join()).not.toMatch(/Power BI|Microsoft/);
  });

  it('les trois jeux de quick wins sont différents', () => {
    const sets = new Set(
      Object.values(results).map((r) =>
        r.quickWins
          .map((w) => w.id)
          .sort()
          .join(),
      ),
    );
    expect(sets.size).toBe(3);
  });

  it('la synthèse cite le point d’attention principal, en français correct', () => {
    expect(results['services-40.yaml']!.summary).toMatch(/la fiabilité de vos chiffres/);
    for (const r of Object.values(results)) expect(r.summary).not.toMatch(/\b(la|le) (sources|autonomie)\b/);
  });
});

describe('outils de texte', () => {
  it('joinNames', () => {
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A et B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B et C');
    expect(joinNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C et 2 autres');
  });

  it('fillTemplate laisse un trou inconnu visible (détecté par les tests)', () => {
    expect(fillTemplate('{a} et {b}', { a: 'X' })).toBe('X et {b}');
  });
});
