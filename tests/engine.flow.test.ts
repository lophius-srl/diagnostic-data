import { describe, expect, it } from 'vitest';
import type { Condition, Question } from '../src/content/schema';
import type { Answers } from '../src/engine/conditions';
import { evaluate } from '../src/engine/conditions';
import {
  effectiveAnswers,
  feedbackAfter,
  nextQuestion,
  progress,
  questionText,
  visibleQuestions,
} from '../src/engine/flow';
import { content, profile, profiles } from './helpers';

describe('conditions', () => {
  const answers: Answers = { secteur: 'services', outils: ['excel', 'odoo', 'fiduciaire'] };

  it('évalue is / in / has / hasAny / countAtLeast', () => {
    expect(evaluate({ q: 'secteur', is: 'services' }, answers)).toBe(true);
    expect(evaluate({ q: 'secteur', in: ['commerce', 'en_ligne'] }, answers)).toBe(false);
    expect(evaluate({ q: 'outils', has: 'odoo' }, answers)).toBe(true);
    expect(evaluate({ q: 'outils', hasAny: ['shopify', 'woocommerce'] }, answers)).toBe(false);
    expect(evaluate({ q: 'outils', countAtLeast: 3 }, answers)).toBe(true);
    expect(evaluate({ q: 'outils', countAtLeast: 3, exclude: ['fiduciaire'] }, answers)).toBe(false);
  });

  it('combine all / any / not', () => {
    const cond: Condition = { all: [{ q: 'secteur', is: 'services' }, { not: { q: 'outils', has: 'shopify' } }] };
    expect(evaluate(cond, answers)).toBe(true);
    expect(
      evaluate(
        {
          any: [
            { q: 'secteur', is: 'commerce' },
            { q: 'outils', has: 'excel' },
          ],
        },
        answers,
      ),
    ).toBe(true);
  });

  it('une question sans réponse rend la condition fausse, même sous not', () => {
    expect(evaluate({ q: 'taille', is: 't1_4' }, answers)).toBe(false);
    expect(evaluate({ fact: 'double_saisie' }, answers)).toBe(false);
  });
});

describe('parcours adaptatif', () => {
  it('commence par le secteur puis enchaîne dans l’ordre', () => {
    expect(nextQuestion(content, {})?.id).toBe('secteur');
    expect(nextQuestion(content, { secteur: 'commerce' })?.id).toBe('taille');
  });

  it('est terminé quand toutes les questions visibles ont une réponse', () => {
    for (const p of profiles) expect(nextQuestion(content, p.answers), p.file).toBeUndefined();
  });

  it('affiche 15 à 20 questions au total dans la config', () => {
    expect(content.questions.length).toBeGreaterThanOrEqual(15);
    expect(content.questions.length).toBeLessThanOrEqual(20);
  });

  /**
   * Parcours exhaustif : on fait varier toutes les réponses des questions dont dépend une condition
   * (pour les cases à cocher : toutes les combinaisons des cases citées dans une condition),
   * les autres réponses étant fixées. Chaque PME doit voir entre 12 et 15 questions.
   */
  it('chaque parcours possible compte 12 à 15 questions', () => {
    const counts = new Set<number>();
    for (const answers of allBranchingPaths()) {
      const n = visibleQuestions(content, answers).length;
      counts.add(n);
      expect(n, JSON.stringify(answers)).toBeGreaterThanOrEqual(12);
      expect(n, JSON.stringify(answers)).toBeLessThanOrEqual(15);
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it('pose exactement une des deux questions « ventes en ligne » / « rentabilité »', () => {
    for (const answers of allBranchingPaths()) {
      const ids = visibleQuestions(content, answers).map((q) => q.id);
      expect(ids.filter((id) => id === 'ventes_en_ligne' || id === 'rentabilite')).toHaveLength(1);
      expect(ids.filter((id) => id === 'personne_excel' || id === 'autonomie')).toHaveLength(1);
    }
  });

  it('adapte le texte de la question rentabilité au secteur', () => {
    const q = content.questions.find((x) => x.id === 'rentabilite') as Question;
    expect(questionText(q, { secteur: 'services' })).toMatch(/projets/);
    expect(questionText(q, { secteur: 'production' })).toMatch(/chantier/);
    expect(questionText(q, { secteur: 'commerce' })).toMatch(/produits/);
  });

  it('ignore les réponses d’une question devenue invisible', () => {
    const answers: Answers = { ...profile('negoce-12.yaml').answers, outils: ['winbooks'] };
    const effective = effectiveAnswers(content, answers);
    expect(effective.personne_excel).toBeUndefined();
    expect(effective.recopie).toBeUndefined();
  });

  it('calcule la progression sur les questions visibles', () => {
    expect(progress(content, { secteur: 'commerce' })).toMatchObject({ answered: 1 });
    const p = profile('services-40.yaml');
    const done = progress(content, p.answers);
    expect(done.answered).toBe(done.total);
  });
});

describe('retours d’expert', () => {
  it('affiche le retour correspondant à la réponse', () => {
    const answers: Answers = {
      secteur: 'commerce',
      taille: 't5_19',
      outils: ['excel', 'winbooks'],
      recopie: 'souvent',
    };
    expect(feedbackAfter(content, answers, 'recopie', -Infinity)?.feedback.id).toBe('recopie_souvent');
  });

  it('respecte un écart minimal entre deux retours', () => {
    const answers: Answers = {
      secteur: 'commerce',
      taille: 't5_19',
      outils: ['excel', 'winbooks'],
      recopie: 'souvent',
    };
    const position = visibleQuestions(content, answers).findIndex((q) => q.id === 'recopie');
    expect(feedbackAfter(content, answers, 'recopie', position - 1)).toBeUndefined();
    expect(feedbackAfter(content, answers, 'recopie', position - content.settings.feedbackMinGap)).toBeDefined();
  });

  it('n’affiche jamais plus d’un retour toutes les 3 questions sur un parcours complet', () => {
    for (const p of profiles) {
      let last = -Infinity;
      const shown: number[] = [];
      for (const q of visibleQuestions(content, p.answers)) {
        const fb = feedbackAfter(content, p.answers, q.id, last);
        if (fb) {
          shown.push(fb.position);
          last = fb.position;
        }
      }
      for (let i = 1; i < shown.length; i++) {
        expect((shown[i] as number) - (shown[i - 1] as number)).toBeGreaterThanOrEqual(content.settings.feedbackMinGap);
      }
      expect(shown.length, p.file).toBeGreaterThan(0);
    }
  });
});

/** Génère toutes les combinaisons de réponses qui influencent l'affichage des questions. */
function allBranchingPaths(): Answers[] {
  const refs = new Map<string, Set<string>>();
  const collect = (c: Condition): void => {
    if ('all' in c) return c.all.forEach(collect);
    if ('any' in c) return c.any.forEach(collect);
    if ('not' in c) return collect(c.not);
    if ('fact' in c) return;
    const set = refs.get(c.q) ?? new Set<string>();
    [c.is, c.has, ...(c.in ?? []), ...(c.hasAny ?? []), ...(c.exclude ?? [])].forEach((id) => id && set.add(id));
    refs.set(c.q, set);
  };
  content.questions.forEach((q) => q.showIf && collect(q.showIf));

  let paths: Record<string, string | string[]>[] = [{}];
  for (const q of content.questions) {
    let choices: (string | string[])[];
    if (!refs.has(q.id)) choices = [(q.options[0] as { id: string }).id];
    else if (q.type === 'single') choices = q.options.map((o) => o.id);
    else {
      // Cases citées dans une condition + une case « neutre » pour atteindre les seuils de comptage.
      const cited = [...(refs.get(q.id) as Set<string>)];
      const neutral = q.options.find((o) => !cited.includes(o.id) && !o.exclusive)?.id;
      const pool = neutral ? [...cited, neutral] : cited;
      choices = subsets(pool).filter((s) => s.length > 0);
    }
    paths = paths.flatMap((p) => choices.map((c) => ({ ...p, [q.id]: c })));
  }
  return paths;
}

function subsets<T>(items: T[]): T[][] {
  return items.reduce<T[][]>((acc, item) => acc.concat(acc.map((s) => [...s, item])), [[]]);
}
