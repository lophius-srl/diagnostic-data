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
  it('commence par les outils puis saute les questions sans objet', () => {
    expect(nextQuestion(content, {})?.id).toBe('outils');
    expect(nextQuestion(content, { outils: ['excel', 'winbooks'] })?.id).toBe('recopie');
    expect(nextQuestion(content, { outils: ['odoo'] })?.id).toBe('ventes_mois');
  });

  it('est terminé quand toutes les questions visibles ont une réponse', () => {
    for (const p of profiles) expect(nextQuestion(content, p.answers), p.file).toBeUndefined();
  });

  it('compte 8 à 12 questions au total dans la config', () => {
    expect(content.questions.length).toBeGreaterThanOrEqual(8);
    expect(content.questions.length).toBeLessThanOrEqual(12);
  });

  /**
   * Parcours exhaustif : on fait varier toutes les réponses des questions dont dépend une condition
   * (pour les cases à cocher : toutes les combinaisons des cases citées dans une condition),
   * les autres réponses étant fixées. Chaque PME doit voir entre 8 et 10 questions.
   */
  it('chaque parcours possible compte 8 à 10 questions', () => {
    const counts = new Set<number>();
    for (const answers of allBranchingPaths()) {
      const n = visibleQuestions(content, answers).length;
      counts.add(n);
      expect(n, JSON.stringify(answers)).toBeGreaterThanOrEqual(8);
      expect(n, JSON.stringify(answers)).toBeLessThanOrEqual(10);
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it('pose exactement une des deux questions « personne Excel » / « autonomie »', () => {
    for (const answers of allBranchingPaths()) {
      const ids = visibleQuestions(content, answers).map((q) => q.id);
      expect(ids.filter((id) => id === 'personne_excel' || id === 'autonomie')).toHaveLength(1);
    }
  });

  it('utilise une variante de texte quand sa condition est vraie', () => {
    const base = content.questions.find((x) => x.id === 'justesse') as Question;
    const q: Question = { ...base, textVariants: [{ when: { q: 'outils', has: 'odoo' }, text: 'Variante Odoo' }] };
    expect(questionText(q, { outils: ['odoo'] })).toBe('Variante Odoo');
    expect(questionText(q, { outils: ['excel'] })).toBe(base.text);
  });

  it('ignore les réponses d’une question devenue invisible', () => {
    const answers: Answers = { ...profile('negoce-12.yaml').answers, outils: ['winbooks'] };
    const effective = effectiveAnswers(content, answers);
    expect(effective.personne_excel).toBeUndefined();
    expect(effective.recopie).toBeUndefined();
  });

  it('calcule la progression sur les questions visibles', () => {
    expect(progress(content, { outils: ['odoo'] })).toMatchObject({ answered: 1 });
    const p = profile('services-40.yaml');
    const done = progress(content, p.answers);
    expect(done.answered).toBe(done.total);
  });
});

describe('retours d’expert', () => {
  it('affiche le retour correspondant à la réponse', () => {
    const answers: Answers = {
      outils: ['excel', 'winbooks'],
      recopie: 'souvent',
    };
    expect(feedbackAfter(content, answers, 'recopie', -Infinity)?.feedback.id).toBe('recopie_souvent');
  });

  it('respecte un écart minimal entre deux retours', () => {
    const answers: Answers = {
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
