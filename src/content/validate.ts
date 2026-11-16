import type { Condition, Content, Question } from './schema';

/**
 * Contrôles de cohérence que le schéma seul ne peut pas exprimer (références croisées).
 * Retourne la liste des erreurs, vide si le contenu est cohérent.
 */
export function validateContent(content: Content): string[] {
  const errors: string[] = [];
  const dimensionIds = new Set(content.dimensions.map((d) => d.id));
  const toolIds = new Set(content.tools.map((t) => t.id));
  const questionIndex = new Map(content.questions.map((q, i) => [q.id, i]));
  const facts = new Set(content.questions.flatMap((q) => q.options.flatMap((o) => o.facts)));

  for (const [label, ids] of [
    ['question', content.questions.map((q) => q.id)],
    ['dimension', content.dimensions.map((d) => d.id)],
    ['niveau', content.levels.map((l) => l.id)],
    ['outil', content.tools.map((t) => t.id)],
    ['retour', content.feedbacks.map((f) => f.id)],
  ] as const) {
    for (const dup of duplicates(ids)) errors.push(`${label} en double : ${dup}`);
  }

  const checkCondition = (cond: Condition, where: string, maxIndex: number): void => {
    if ('all' in cond) return cond.all.forEach((c) => checkCondition(c, where, maxIndex));
    if ('any' in cond) return cond.any.forEach((c) => checkCondition(c, where, maxIndex));
    if ('not' in cond) return checkCondition(cond.not, where, maxIndex);
    if ('fact' in cond) {
      if (!facts.has(cond.fact)) errors.push(`${where} : fait inconnu « ${cond.fact} »`);
      return;
    }
    const index = questionIndex.get(cond.q);
    if (index === undefined) return void errors.push(`${where} : question inconnue « ${cond.q} »`);
    if (index > maxIndex) errors.push(`${where} : dépend de « ${cond.q} », posée plus tard`);
    const target = content.questions[index] as Question;
    const optionIds = new Set(target.options.map((o) => o.id));
    const used = [cond.is, cond.has, ...(cond.in ?? []), ...(cond.hasAny ?? []), ...(cond.exclude ?? [])];
    for (const id of used) {
      if (id !== undefined && !optionIds.has(id))
        errors.push(`${where} : réponse « ${id} » inexistante pour « ${cond.q} »`);
    }
    const isSingle = target.type === 'single';
    if (isSingle && (cond.has || cond.hasAny || cond.countAtLeast))
      errors.push(`${where} : « ${cond.q} » est à choix unique (utiliser is / in)`);
    if (!isSingle && (cond.is || cond.in))
      errors.push(`${where} : « ${cond.q} » est à choix multiples (utiliser has / hasAny / countAtLeast)`);
  };

  content.questions.forEach((q, i) => {
    for (const dup of duplicates(q.options.map((o) => o.id))) errors.push(`${q.id} : réponse en double ${dup}`);
    if (q.showIf) checkCondition(q.showIf, `${q.id}.showIf`, i - 1);
    q.textVariants.forEach((v, j) => checkCondition(v.when, `${q.id}.textVariants[${j}]`, i - 1));
    for (const o of q.options) {
      for (const dim of Object.keys(o.scores))
        if (!dimensionIds.has(dim)) errors.push(`${q.id}.${o.id} : dimension inconnue « ${dim} »`);
      if (o.tool && !toolIds.has(o.tool)) errors.push(`${q.id}.${o.id} : outil inconnu « ${o.tool} »`);
    }
    if (q.type === 'tools' && q.options.some((o) => !o.tool && !o.exclusive))
      errors.push(`${q.id} : chaque case d'une question « tools » doit pointer vers un outil`);
  });

  for (const f of content.feedbacks) {
    const index = questionIndex.get(f.after);
    if (index === undefined) errors.push(`retour ${f.id} : question inconnue « ${f.after} »`);
    else checkCondition(f.when, `retour ${f.id}`, index);
  }

  for (const dim of content.dimensions) {
    const count = content.questions.filter((q) => q.options.some((o) => dim.id in o.scores)).length;
    if (count < 2) errors.push(`dimension ${dim.id} : mesurée par moins de 2 questions`);
  }

  content.levels.forEach((l) => {
    if (l.blockedBy) checkCondition(l.blockedBy, `niveau ${l.id}.blockedBy`, content.questions.length - 1);
  });

  const mins = content.levels.map((l) => l.min);
  if (mins[0] !== 0) errors.push('niveaux : le premier doit commencer à 0');
  if (mins.some((m, i) => i > 0 && m <= (mins[i - 1] as number)))
    errors.push('niveaux : seuils strictement croissants attendus');

  const hc = content.settings.hiddenCost;
  const hcQuestion = content.questions.find((q) => q.id === hc.question);
  if (!hcQuestion) errors.push(`coût caché : question inconnue « ${hc.question} »`);
  else
    for (const o of hcQuestion.options)
      if (!(o.id in hc.hoursPerWeek)) errors.push(`coût caché : heures manquantes pour « ${o.id} »`);

  return errors;
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}
