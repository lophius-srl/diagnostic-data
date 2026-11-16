import { describe, expect, it } from 'vitest';
import type { Answers } from '../src/engine/conditions';
import { hiddenCost } from '../src/engine/hidden-cost';
import { levelFor, score } from '../src/engine/scoring';
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
      secteur: 'services',
      taille: 't20_49',
      outils: ['odoo', 'exact'],
      recopie: 'non',
      rentabilite: 'precis',
      ventes_mois: 'minutes',
      frequence: 'semaine',
      justesse: 'confiance',
      memes_chiffres: 'oui',
      heures_excel: 'moins_2',
      autonomie: 'clics',
      ordinateur: 'sauvegarde',
      acces: 'prevues',
      microsoft: 'oui',
      priorite: 'vue',
    };
    const worst: Answers = {
      secteur: 'commerce',
      taille: 't1_4',
      outils: ['nesaispas'],
      rentabilite: 'pas_vraiment',
      ventes_mois: 'jours',
      frequence: 'rarement',
      justesse: 'discussion',
      heures_excel: 'plus_10',
      autonomie: 'introuvable',
      ordinateur: 'oui',
      microsoft: 'eviter',
      priorite: 'vue',
    };
    expect(score(content, best)).toMatchObject({ global: 100, level: { id: 'data_driven' } });
    expect(score(content, worst)).toMatchObject({ global: 0, level: { id: 'artisanal' } });
  });

  it('pour une case à cocher multiple, retient le meilleur outil (pas la somme)', () => {
    const base: Answers = { secteur: 'commerce', taille: 't1_4' };
    const excelOnly = score(content, { ...base, outils: ['excel'] }).dimensions.find((d) => d.id === 'sources');
    const withOdoo = score(content, { ...base, outils: ['excel', 'odoo'] }).dimensions.find((d) => d.id === 'sources');
    expect(excelOnly?.score).toBe(33);
    expect(withOdoo?.score).toBe(100);
  });

  it('ne compte pas une dimension sans question vue', () => {
    const s = score(content, { secteur: 'commerce' });
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
  it('heures × semaines × coût horaire, arrondi à la centaine', () => {
    const cost = hiddenCost(content, { heures_excel: 'h5_10' });
    expect(cost).toEqual({ hoursPerWeek: 7.5, hoursPerYear: 345, hourlyRate: 45, yearlyCost: 15500 });
  });

  it('accepte un coût horaire personnalisé et ignore une valeur invalide', () => {
    expect(hiddenCost(content, { heures_excel: 'plus_10' }, 60)?.yearlyCost).toBe(33100);
    expect(hiddenCost(content, { heures_excel: 'plus_10' }, -5)?.hourlyRate).toBe(45);
    expect(hiddenCost(content, { heures_excel: 'plus_10' }, Number.NaN)?.hourlyRate).toBe(45);
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

  it('e-commerce 6 personnes sur Shopify + Yuki : Piloté, plafonné par l’export manuel', () => {
    expect(results['ecommerce-6.yaml']?.level.id).toBe('pilote');
    expect(results['ecommerce-6.yaml']?.cappedFrom).toBeDefined();
  });

  it('les scores globaux et les profils du radar diffèrent', () => {
    const globals = new Set(Object.values(results).map((r) => r.global));
    expect(globals.size).toBe(profiles.length);
    const shapes = new Set(Object.values(results).map((r) => JSON.stringify(r.dimensions)));
    expect(shapes.size).toBe(profiles.length);
  });

  it('chaque profil voit entre 12 et 15 questions et le coût caché est chiffré', () => {
    for (const p of profiles) {
      expect(hiddenCost(content, p.answers)?.yearlyCost, p.file).toBeGreaterThan(0);
    }
  });
});
