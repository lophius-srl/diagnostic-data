import { describe, expect, it } from 'vitest';
import type { Answers } from '../src/engine/conditions';
import { hiddenCost } from '../src/engine/hidden-cost';
import { insightFor, levelFor, score } from '../src/engine/scoring';
import { content, profile, profiles } from './helpers';

describe('scoring', () => {
  it('est déterministe', () => {
    for (const p of profiles) expect(score(content, p.answers)).toEqual(score(content, p.answers));
  });

  it('reste entre 0 et 100 pour le global et chaque dimension', () => {
    for (const p of profiles) {
      const s = score(content, p.answers);
      expect(s.global).toBeGreaterThanOrEqual(0);
      expect(s.global).toBeLessThanOrEqual(100);
      for (const d of s.dimensions) if (d.score !== null) expect(d.score).toBeGreaterThanOrEqual(0);
      for (const d of s.dimensions) if (d.score !== null) expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it('donne 100 avec les meilleures réponses et 0 avec les pires', () => {
    const best: Answers = {
      outils: ['odoo', 'exact'],
      recopie: 'non',
      ventes_mois: 'minutes',
      frequence: 'semaine',
      justesse: 'confiance',
      temps_tableaux: 'heures',
      autonomie: 'clics',
      ordinateur: 'sauvegarde',
      microsoft: 'oui',
      priorite: 'vue',
    };
    const worst: Answers = {
      outils: ['nesaispas'],
      ventes_mois: 'jours',
      frequence: 'rarement',
      justesse: 'discussion',
      temps_tableaux: 'semaine',
      autonomie: 'introuvable',
      ordinateur: 'oui',
      microsoft: 'eviter',
      priorite: 'vue',
    };
    expect(score(content, best)).toMatchObject({ global: 100, level: { id: 'data_driven' } });
    expect(score(content, worst)).toMatchObject({ global: 0, level: { id: 'artisanal' } });
  });

  it('pour une case à cocher multiple, retient le meilleur outil (pas la somme)', () => {
    const base: Answers = {};
    const excelOnly = score(content, { ...base, outils: ['excel'] }).dimensions.find((d) => d.id === 'sources');
    const withOdoo = score(content, { ...base, outils: ['excel', 'odoo'] }).dimensions.find((d) => d.id === 'sources');
    expect(excelOnly?.score).toBe(33);
    expect(withOdoo?.score).toBe(100);
  });

  it('ne compte pas une dimension sans question vue', () => {
    const s = score(content, {});
    expect(s.dimensions.every((d) => d.score === null)).toBe(true);
    expect(s.global).toBe(0);
  });

  it('associe le bon niveau aux seuils', () => {
    expect(levelFor(content, 0).id).toBe('artisanal');
    expect(levelFor(content, 20).id).toBe('structure');
    expect(levelFor(content, 59).id).toBe('pilote');
    expect(levelFor(content, 60).id).toBe('automatise');
    expect(levelFor(content, 100).id).toBe('data_driven');
  });

  it('plafonne le niveau quand des chiffres passent encore à la main', () => {
    const s = score(content, profile('ecommerce-6.yaml').answers);
    expect(s.global).toBeGreaterThanOrEqual(60);
    expect(s.level.id).toBe('pilote');
    expect(s.cappedFrom?.id).toBe('automatise');
  });
});

describe('coût caché', () => {
  it('heures par mois × mois × coût horaire, arrondi à la centaine', () => {
    const cost = hiddenCost(content, { temps_tableaux: 'jours' });
    expect(cost).toEqual({ hoursPerMonth: 20, hoursPerYear: 220, hourlyRate: 45, yearlyCost: 9900 });
  });

  it('accepte un coût horaire personnalisé et ignore une valeur invalide', () => {
    expect(hiddenCost(content, { temps_tableaux: 'semaine' }, 60)?.yearlyCost).toBe(26400);
    expect(hiddenCost(content, { temps_tableaux: 'semaine' }, -5)?.hourlyRate).toBe(45);
    expect(hiddenCost(content, { temps_tableaux: 'semaine' }, Number.NaN)?.hourlyRate).toBe(45);
  });

  it('est indéfini sans réponse', () => {
    expect(hiddenCost(content, {})).toBeUndefined();
  });
});

describe('les 3 profils de test obtiennent un résultat crédible et différent', () => {
  const results = Object.fromEntries(profiles.map((p) => [p.file, score(content, p.answers)]));

  it('négoce 12 personnes sur Excel + WinBooks : Structuré', () => {
    expect(results['negoce-12.yaml']?.level.id).toBe('structure');
  });

  it('services 40 personnes sur Odoo : Piloté, fragile sur la fiabilité', () => {
    const r = results['services-40.yaml'];
    expect(r?.level.id).toBe('pilote');
    const weakest = [...(r?.dimensions ?? [])].sort((a, b) => (a.score ?? 101) - (b.score ?? 101))[0];
    expect(weakest?.id).toBe('fiabilite');
  });

  it('e-commerce 6 personnes sur Shopify + Yuki : Piloté, plafonné par la double saisie', () => {
    expect(results['ecommerce-6.yaml']?.level.id).toBe('pilote');
    expect(results['ecommerce-6.yaml']?.cappedFrom).toBeDefined();
  });

  it('les scores globaux et les profils du radar diffèrent', () => {
    const globals = new Set(Object.values(results).map((r) => r.global));
    expect(globals.size).toBe(profiles.length);
    const shapes = new Set(Object.values(results).map((r) => JSON.stringify(r.dimensions)));
    expect(shapes.size).toBe(profiles.length);
  });

  it('le coût caché est chiffré pour chaque profil', () => {
    for (const p of profiles) {
      expect(hiddenCost(content, p.answers)?.yearlyCost, p.file).toBeGreaterThan(0);
    }
  });
});

describe('lecture axe par axe', () => {
  it('choisit la phrase selon le score (bas < 40, moyen < 70, haut)', () => {
    const d = content.dimensions[0]!;
    expect(insightFor(d, 39)).toBe(d.insights.low);
    expect(insightFor(d, 40)).toBe(d.insights.mid);
    expect(insightFor(d, 69)).toBe(d.insights.mid);
    expect(insightFor(d, 70)).toBe(d.insights.high);
    expect(insightFor(d, null)).toBe('');
  });
});
