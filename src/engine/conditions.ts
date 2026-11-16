import type { Condition, Content } from '../content/schema';

/** Réponses : un identifiant d'option (choix unique) ou une liste (choix multiples). */
export type Answers = Readonly<Record<string, string | readonly string[]>>;

export function selected(answers: Answers, questionId: string): readonly string[] {
  const value = answers[questionId];
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : value;
}

/** Faits métier déduits des réponses (ex. « double_saisie »). */
export function factsOf(content: Content, answers: Answers): Set<string> {
  const facts = new Set<string>();
  for (const q of content.questions) {
    const chosen = new Set(selected(answers, q.id));
    for (const o of q.options) if (chosen.has(o.id)) o.facts.forEach((f) => facts.add(f));
  }
  return facts;
}

/** Évalue une condition. Une condition sur une question sans réponse est fausse. */
export function evaluate(cond: Condition, answers: Answers, facts: ReadonlySet<string> = new Set()): boolean {
  if ('all' in cond) return cond.all.every((c) => evaluate(c, answers, facts));
  if ('any' in cond) return cond.any.some((c) => evaluate(c, answers, facts));
  if ('not' in cond) return !evaluate(cond.not, answers, facts);
  if ('fact' in cond) return facts.has(cond.fact);

  if (answers[cond.q] === undefined) return false;
  const chosen = selected(answers, cond.q);
  if (cond.is !== undefined) return chosen.length === 1 && chosen[0] === cond.is;
  if (cond.in !== undefined) return chosen.length === 1 && cond.in.includes(chosen[0] as string);
  if (cond.has !== undefined) return chosen.includes(cond.has);
  if (cond.hasAny !== undefined) return cond.hasAny.some((id) => chosen.includes(id));
  if (cond.countAtLeast !== undefined) {
    const excluded = new Set(cond.exclude ?? []);
    return chosen.filter((id) => !excluded.has(id)).length >= cond.countAtLeast;
  }
  return false;
}
