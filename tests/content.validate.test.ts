import { describe, expect, it } from 'vitest';
import { BenchmarkSchema, ContentSchema, type Content } from '../src/content/schema';
import { validateContent } from '../src/content/validate';
import { content } from './helpers';

const clone = (): Content => structuredClone(content);

describe('validation du contenu', () => {
  it('le contenu livré est valide et cohérent', () => {
    expect(ContentSchema.safeParse(content).success).toBe(true);
    expect(validateContent(content)).toEqual([]);
  });

  it('refuse une condition qui dépend d’une question posée plus tard', () => {
    const c = clone();
    c.questions[0] = { ...c.questions[0]!, showIf: { q: 'priorite', is: 'vue' } };
    expect(validateContent(c).join()).toMatch(/posée plus tard/);
  });

  it('refuse une réponse inexistante dans une condition', () => {
    const c = clone();
    c.feedbacks[0] = { ...c.feedbacks[0]!, when: { q: 'outils', has: 'inconnu' } };
    expect(validateContent(c).join()).toMatch(/inexistante/);
  });

  it('refuse un opérateur incompatible avec le type de question', () => {
    const c = clone();
    c.feedbacks[0] = { ...c.feedbacks[0]!, when: { q: 'outils', is: 'excel' } };
    expect(validateContent(c).join()).toMatch(/choix multiples/);
  });

  it('refuse une dimension inconnue', () => {
    const c = clone();
    const q = c.questions.find((x) => x.id === 'justesse')!;
    q.options[0] = { ...q.options[0]!, scores: { qualite: 3 } };
    expect(validateContent(c).join()).toMatch(/dimension inconnue/);
  });

  it('refuse des seuils de niveaux non croissants', () => {
    const c = clone();
    c.levels[2] = { ...c.levels[2]!, min: 10 };
    expect(validateContent(c).join()).toMatch(/croissants/);
  });

  it('refuse un coût caché sans heures pour une tranche', () => {
    const c = clone();
    delete c.settings.hiddenCost.hoursPerWeek.plus_10;
    expect(validateContent(c).join()).toMatch(/heures manquantes/);
  });

  it('refuse d’activer un repère sans source', () => {
    expect(BenchmarkSchema.safeParse({ id: 'x', text: 't', source: null, enabled: true }).success).toBe(false);
    expect(BenchmarkSchema.safeParse({ id: 'x', text: 't', source: 'Enquête X, 2026', enabled: true }).success).toBe(
      true,
    );
  });
});
