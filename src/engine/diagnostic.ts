import type { Content } from '../content/schema';
import type { Answers } from './conditions';
import { hiddenCost, type HiddenCost } from './hidden-cost';
import {
  quickWins,
  recoContext,
  recommendedOffers,
  roadmap,
  type RenderedAction,
  type RenderedOffer,
  type RoadmapPhase,
} from './recommend';
import { score, type ScoreResult } from './scoring';

/** Résultat complet d'un diagnostic : tout ce qu'affichent la page de résultats et le rapport PDF. */
export interface DiagnosticResult {
  score: ScoreResult;
  hiddenCost: HiddenCost | undefined;
  quickWins: RenderedAction[];
  roadmap: RoadmapPhase[];
  offers: RenderedOffer[];
  /** Points forts et points d'attention (axes évalués, du meilleur au moins bon). */
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

/**
 * Rédige la synthèse du diagnostic. L'implémentation actuelle est à base de règles ;
 * un module « synthèse rédigée par IA » pourra implémenter la même interface plus tard.
 */
export interface Synthesizer {
  summarize(content: Content, result: Omit<DiagnosticResult, 'summary'>): string;
}

export const ruleBasedSynthesizer: Synthesizer = {
  summarize(content, result) {
    const label = (id: string | undefined) => content.dimensions.find((d) => d.id === id)?.phrase ?? '';
    const ui = content.ui;
    const parts = [result.score.level.summary];
    if (result.strengths[0]) parts.push((ui.summary_strength ?? '').replace('{dimension}', label(result.strengths[0])));
    if (result.weaknesses[0])
      parts.push((ui.summary_weakness ?? '').replace('{dimension}', label(result.weaknesses[0])));
    return parts.filter(Boolean).join(' ');
  },
};

export function buildDiagnostic(
  content: Content,
  answers: Answers,
  options: { hourlyRate?: number; synthesizer?: Synthesizer } = {},
): DiagnosticResult {
  const scoreResult = score(content, answers);
  const ctx = recoContext(content, answers);
  const wins = quickWins(ctx, scoreResult);
  const evaluated = scoreResult.dimensions
    .filter((d): d is { id: string; score: number } => d.score !== null)
    .sort((a, b) => b.score - a.score);
  const partial = {
    score: scoreResult,
    hiddenCost: hiddenCost(content, answers, options.hourlyRate),
    quickWins: wins,
    roadmap: roadmap(ctx, wins),
    offers: recommendedOffers(ctx, scoreResult),
    strengths: evaluated
      .filter((d) => d.score >= 60 && content.dimensions.find((x) => x.id === d.id)?.strengthCandidate)
      .map((d) => d.id),
    weaknesses: [...evaluated]
      .reverse()
      .filter((d) => d.score < 50)
      .slice(0, 2)
      .map((d) => d.id),
  };
  return { ...partial, summary: (options.synthesizer ?? ruleBasedSynthesizer).summarize(content, partial) };
}
