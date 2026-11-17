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

  const capabilities = new Set(content.tools.flatMap((t) => t.capabilities));
  const toolQuestionIndex = content.questions.findIndex((q) => q.type === 'tools');
  /** Seul trou permis dans une question ou un retour : {outils}, une fois les outils connus. */
  const checkToolText = (text: string, where: string, index: number): void => {
    for (const slot of placeholders(text)) {
      if (slot !== 'outils') errors.push(`${where} : trou {${slot}} non défini`);
      else if (toolQuestionIndex < 0 || toolQuestionIndex >= index)
        errors.push(`${where} : {outils} utilisé avant la question des outils`);
    }
  };

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
    q.suggest.forEach((rule, j) => {
      const where = `${q.id}.suggest[${j}]`;
      if (rule.when) checkCondition(rule.when, where, i - 1);
      if (!q.options.some((o) => o.id === rule.option)) errors.push(`${where} : réponse inconnue « ${rule.option} »`);
      if (rule.capability && !capabilities.has(rule.capability))
        errors.push(`${where} : aucun outil n'a la fonction « ${rule.capability} »`);
    });
    for (const text of [q.text, ...q.textVariants.map((v) => v.text), ...q.suggest.map((r) => r.reason)])
      checkToolText(text, `${q.id}`, i);
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
    else {
      checkCondition(f.when, `retour ${f.id}`, index);
      checkToolText(f.text, `retour ${f.id}`, index + 1);
    }
  }

  for (const dim of content.dimensions) {
    const count = content.questions.filter((q) => q.options.some((o) => dim.id in o.scores)).length;
    if (count < 1) errors.push(`dimension ${dim.id} : mesurée par aucune question`);
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
      if (!(o.id in hc.hoursPerMonth)) errors.push(`coût caché : heures manquantes pour « ${o.id} »`);

  const checkLate = (cond: Condition, where: string) => checkCondition(cond, where, content.questions.length - 1);
  validateRecommendations(content, errors, checkLate);
  validateArchitecture(content, errors, checkLate);
  return errors;
}

/** Trous {xxx} d'un texte. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string);
}

function validateRecommendations(
  content: Content,
  errors: string[],
  checkCondition: (cond: Condition, where: string) => void,
): void {
  const { variables, quickWins, roadmap } = content.recommendations;
  const variableIds = new Set(variables.map((v) => v.id));
  const toolIds = new Set(content.tools.map((t) => t.id));
  const dimensionIds = new Set(content.dimensions.map((d) => d.id));
  const quickWinIds = new Set(quickWins.map((q) => q.id));

  variables.forEach((v) => v.rules.forEach((r, i) => r.when && checkCondition(r.when, `variable ${v.id}[${i}]`)));

  const checkTexts = (where: string, texts: string[], toolSlots: Record<string, string[]>) => {
    for (const text of texts) {
      for (const slot of placeholders(text)) {
        if (!variableIds.has(slot) && !(slot in toolSlots)) errors.push(`${where} : trou {${slot}} non défini`);
      }
    }
    for (const [slot, ids] of Object.entries(toolSlots)) {
      for (const id of ids) if (!toolIds.has(id)) errors.push(`${where} : outil inconnu « ${id} » dans {${slot}}`);
    }
  };

  const allActions = [...quickWins, ...roadmap.flatMap((p) => p.actions)];
  for (const dup of duplicates(allActions.map((a) => a.id))) errors.push(`action en double : ${dup}`);

  for (const a of allActions) {
    const where = `action ${a.id}`;
    for (const c of [a.when, a.excludeIf, 'boostIf' in a ? a.boostIf : undefined]) if (c) checkCondition(c, where);
    checkTexts(where, [a.title, a.detail], a.requiresTools);
    if ('dimension' in a && !dimensionIds.has(a.dimension))
      errors.push(`${where} : dimension inconnue « ${a.dimension} »`);
    if ('unlessQuickWin' in a && a.unlessQuickWin && !quickWinIds.has(a.unlessQuickWin))
      errors.push(`${where} : quick win inconnu « ${a.unlessQuickWin} »`);
  }
  if (quickWins.filter((q) => q.fallback && !q.when && Object.keys(q.requiresTools).length === 0).length < 3)
    errors.push('quick wins : au moins 3 actions de secours sans condition sont nécessaires');

  for (const o of content.offers.offers) {
    const where = `forfait ${o.id}`;
    for (const c of [o.recommendIf, o.preferredIf]) if (c) checkCondition(c, where);
    checkTexts(where, [o.title, o.summary, o.why, ...o.deliverables], {});
  }
}

function validateArchitecture(
  content: Content,
  errors: string[],
  checkCondition: (cond: Condition, where: string) => void,
): void {
  const { today, target } = content.architecture;
  const toolIds = new Set(content.tools.map((t) => t.id));
  const variableIds = new Set(content.recommendations.variables.map((v) => v.id));
  checkCondition(today.silo.when, 'schéma : silo');
  checkCondition(today.people.autoWhen, 'schéma : direction');
  if (today.externalAutoWhen) checkCondition(today.externalAutoWhen, 'schéma : fiduciaire');
  today.toolNotes.forEach((n, i) => {
    if (n.when) checkCondition(n.when, `schéma : note d'outil ${i}`);
    for (const id of n.tools) if (!toolIds.has(id)) errors.push(`schéma : outil inconnu « ${id} »`);
  });
  today.excel.notes.forEach((n, i) => n.when && checkCondition(n.when, `schéma : note Excel ${i}`));
  target.outputs.forEach((o, i) => {
    if (o.when) checkCondition(o.when, `schéma : sortie ${i}`);
    for (const id of o.requiresTools ?? []) if (!toolIds.has(id)) errors.push(`schéma : outil inconnu « ${id} »`);
    for (const slot of placeholders(o.label + o.detail))
      if (!variableIds.has(slot)) errors.push(`schéma : sortie ${i}, trou {${slot}} non défini`);
  });
}

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}
