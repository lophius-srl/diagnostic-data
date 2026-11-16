import type { Content, Dimension, Level } from '../content/schema';
import { evaluate, factsOf, selected, type Answers } from './conditions';
import { effectiveAnswers, visibleQuestions } from './flow';

export interface DimensionScore {
  id: string;
  /** Score de 0 à 100, ou `null` si aucune question vue ne mesure cette dimension. */
  score: number | null;
}

export interface ScoreResult {
  global: number;
  level: Level;
  /** Niveau que le score seul aurait atteint, si un plafond s'applique. */
  cappedFrom?: Level;
  dimensions: DimensionScore[];
}

/**
 * Score déterministe.
 *  - Choix unique : points de l'option choisie.
 *  - Choix multiples : points de la meilleure case cochée (avoir plus d'outils n'est pas mieux).
 *  - Dimension : points obtenus / maximum possible sur les questions vues, ramené sur 100.
 *  - Global : moyenne pondérée des dimensions évaluées, arrondie.
 */
export function score(content: Content, rawAnswers: Answers): ScoreResult {
  const answers = effectiveAnswers(content, rawAnswers);
  const totals = new Map(content.dimensions.map((d) => [d.id, { got: 0, max: 0 }]));

  for (const q of visibleQuestions(content, answers)) {
    if (answers[q.id] === undefined) continue;
    const chosen = new Set(selected(answers, q.id));
    for (const [dim, total] of totals) {
      const scored = q.options.filter((o) => dim in o.scores);
      if (scored.length === 0) continue;
      const pointsOf = (id: string) => q.options.find((o) => o.id === id)?.scores[dim] ?? 0;
      total.max += Math.max(...scored.map((o) => o.scores[dim] ?? 0));
      total.got += Math.max(0, ...[...chosen].map(pointsOf));
    }
  }

  const dimensions = content.dimensions.map((d) => {
    const t = totals.get(d.id);
    return { id: d.id, score: t && t.max > 0 ? Math.round((100 * t.got) / t.max) : null };
  });

  let weighted = 0;
  let weights = 0;
  for (const d of content.dimensions) {
    const s = dimensions.find((x) => x.id === d.id)?.score;
    if (s === null || s === undefined) continue;
    weighted += s * d.weight;
    weights += d.weight;
  }
  const global = weights > 0 ? Math.round(weighted / weights) : 0;
  const byScore = levelFor(content, global);
  const level = levelFor(content, global, answers);
  return { global, level, ...(level.id !== byScore.id && { cappedFrom: byScore }), dimensions };
}

/**
 * Niveau atteint pour un score. Avec des réponses, les plafonds (`blockedBy`) s'appliquent :
 * on descend jusqu'au premier niveau non bloqué.
 */
export function levelFor(content: Content, globalScore: number, answers?: Answers): Level {
  const facts = answers ? factsOf(content, answers) : new Set<string>();
  const reached = content.levels.filter((l) => globalScore >= l.min);
  for (let i = reached.length - 1; i > 0; i--) {
    const level = reached[i] as Level;
    if (!answers || !level.blockedBy || !evaluate(level.blockedBy, answers, facts)) return level;
  }
  return content.levels[0] as Level;
}

/** Phrase d'interprétation d'un axe selon son score : bas (< 40), moyen (< 70) ou haut. */
export function insightFor(dimension: Dimension, score: number | null): string {
  if (score === null) return '';
  if (score < 40) return dimension.insights.low;
  return score < 70 ? dimension.insights.mid : dimension.insights.high;
}
