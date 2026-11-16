import type { Action, Condition, Content, Offer, RoadmapAction } from '../content/schema';
import { evaluate, factsOf, selected, type Answers } from './conditions';
import { effectiveAnswers } from './flow';
import type { ScoreResult } from './scoring';

export interface RenderedAction {
  id: string;
  title: string;
  detail: string;
  dimension?: string;
  effort?: Action['effort'];
  impact?: Action['impact'];
  /** Outils cochés cités dans le texte (pour les tests de cohérence et les schémas). */
  toolIds: string[];
}

export interface RoadmapPhase {
  id: string;
  label: string;
  title: string;
  actions: RenderedAction[];
}

export interface RenderedOffer {
  id: string;
  title: string;
  duration: string;
  price: string;
  summary: string;
  deliverables: string[];
  why: string;
}

const WEIGHT = { faible: 1, moyen: 2, eleve: 3 } as const;
const BOOST = 1.5;
const LOW_EFFORT_BONUS = 0.3;
const QUICK_WIN_COUNT = 3;

/** Contexte d'évaluation commun : réponses effectives, faits et variables de texte. */
export interface RecoContext {
  content: Content;
  answers: Answers;
  facts: Set<string>;
  variables: Record<string, string>;
}

export function recoContext(content: Content, rawAnswers: Answers): RecoContext {
  const answers = effectiveAnswers(content, rawAnswers);
  const facts = factsOf(content, answers);
  const variables: Record<string, string> = {};
  for (const v of content.recommendations.variables) {
    const rule = v.rules.find((r) => !r.when || evaluate(r.when, answers, facts));
    if (rule) variables[v.id] = rule.value;
  }
  return { content, answers, facts, variables };
}

/** « A », « A et B », « A, B et C », au-delà de 3 : « A, B, C et 2 autres » (titres lisibles). */
export function joinNames(names: readonly string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length > max) return `${names.slice(0, max).join(', ')} et ${names.length - max} autres`;
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

const holds = (ctx: RecoContext, cond: Condition | undefined) =>
  cond === undefined || evaluate(cond, ctx.answers, ctx.facts);

/** Outils cochés pour chaque trou ; `undefined` si un trou n'a aucun outil coché (action impossible). */
function toolSlots(ctx: RecoContext, requiresTools: Record<string, string[]>) {
  const chosen = new Set(
    ctx.content.questions.filter((q) => q.type === 'tools').flatMap((q) => selected(ctx.answers, q.id)),
  );
  const toolOf = (optionId: string) =>
    ctx.content.questions.flatMap((q) => q.options).find((o) => o.id === optionId && o.tool)?.tool;
  const chosenTools = new Set([...chosen].map(toolOf).filter((t): t is string => t !== undefined));

  const names: Record<string, string> = {};
  const ids: string[] = [];
  for (const [slot, allowed] of Object.entries(requiresTools)) {
    const present = allowed.filter((id) => chosenTools.has(id));
    if (present.length === 0) return undefined;
    names[slot] = joinNames(present.map((id) => ctx.content.tools.find((t) => t.id === id)?.name ?? id));
    ids.push(...present);
  }
  return { names, ids: [...new Set(ids)] };
}

/** Rend une action si elle est applicable à cette PME, sinon `undefined`. */
export function renderAction(ctx: RecoContext, action: Action | RoadmapAction): RenderedAction | undefined {
  if (!holds(ctx, action.when)) return undefined;
  if (action.excludeIf && holds(ctx, action.excludeIf)) return undefined;
  const slots = toolSlots(ctx, action.requiresTools);
  if (!slots) return undefined;
  const values = { ...ctx.variables, ...slots.names };
  return {
    id: action.id,
    title: fillTemplate(action.title, values),
    detail: fillTemplate(action.detail, values),
    ...('dimension' in action && { dimension: action.dimension, effort: action.effort, impact: action.impact }),
    toolIds: slots.ids,
  };
}

/**
 * Les 3 quick wins : impact × écart de l'axe, + bonus si la priorité déclarée correspond, + petit bonus si l'effort est faible.
 * On privilégie des axes différents, puis on complète ; les actions de secours ne servent qu'en dernier recours.
 */
export function quickWins(ctx: RecoContext, score: ScoreResult): RenderedAction[] {
  const dimScore = new Map(score.dimensions.map((d) => [d.id, d.score]));
  const ranked = ctx.content.recommendations.quickWins
    .map((action, order) => {
      const rendered = renderAction(ctx, action);
      if (!rendered) return undefined;
      const gap = (100 - (dimScore.get(action.dimension) ?? 50)) / 100;
      const rank =
        WEIGHT[action.impact] * gap +
        (action.boostIf && holds(ctx, action.boostIf) ? BOOST : 0) +
        (action.effort === 'faible' ? LOW_EFFORT_BONUS : 0);
      return { action, rendered, rank, order };
    })
    .filter((x): x is NonNullable<typeof x> => x !== undefined)
    .sort((a, b) => b.rank - a.rank || a.order - b.order);

  const main = ranked.filter((r) => !r.action.fallback);
  const picked: typeof ranked = [];
  const usedDims = new Set<string>();
  for (const r of main) {
    if (picked.length < QUICK_WIN_COUNT && !usedDims.has(r.action.dimension)) {
      picked.push(r);
      usedDims.add(r.action.dimension);
    }
  }
  for (const r of [...main, ...ranked.filter((x) => x.action.fallback)]) {
    if (picked.length < QUICK_WIN_COUNT && !picked.includes(r)) picked.push(r);
  }
  return picked.map((r) => r.rendered);
}

/** Feuille de route : les quick wins ouvrent les 30 premiers jours, puis les étapes de la config. */
export function roadmap(ctx: RecoContext, wins: RenderedAction[]): RoadmapPhase[] {
  const winIds = new Set(wins.map((w) => w.id));
  return ctx.content.recommendations.roadmap.map((phase, index) => {
    const steps = phase.actions
      .filter((a) => !a.unlessQuickWin || !winIds.has(a.unlessQuickWin))
      .map((a) => renderAction(ctx, a))
      .filter((a): a is RenderedAction => a !== undefined);
    const actions = (index === 0 ? [...wins, ...steps] : steps).slice(
      0,
      Math.max(phase.max, index === 0 ? wins.length : 0),
    );
    return { id: phase.id, label: phase.label, title: phase.title, actions };
  });
}

/** Forfaits recommandés : ceux qui correspondent, celui de la priorité déclarée en tête ; l'audit par défaut. */
export function recommendedOffers(ctx: RecoContext, score: ScoreResult): RenderedOffer[] {
  const { offers, maxRecommended } = ctx.content.offers;
  const matches = (o: Offer) =>
    (o.recommendIf !== undefined && holds(ctx, o.recommendIf)) ||
    (o.recommendBelowScore !== undefined && score.global < o.recommendBelowScore);
  const rank = (o: Offer) => (o.preferredIf && holds(ctx, o.preferredIf) ? 100 : 0) + o.priority;
  const chosen = offers
    .filter(matches)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, maxRecommended);
  return (chosen.length > 0 ? chosen : offers.slice(0, 1)).map((o) => renderOffer(ctx, o));
}

function renderOffer(ctx: RecoContext, o: Offer): RenderedOffer {
  const fill = (text: string) => fillTemplate(text, ctx.variables);
  return {
    id: o.id,
    title: fill(o.title),
    duration: o.duration,
    price: o.price,
    summary: fill(o.summary),
    deliverables: o.deliverables.map(fill),
    why: fill(o.why),
  };
}
