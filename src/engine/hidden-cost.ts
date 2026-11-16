import type { Content } from '../content/schema';
import { selected, type Answers } from './conditions';

export interface HiddenCost {
  hoursPerMonth: number;
  hoursPerYear: number;
  hourlyRate: number;
  /** Coût annuel arrondi (settings.hiddenCost.roundTo). */
  yearlyCost: number;
}

/**
 * Coût annuel du reporting manuel : heures par mois × mois travaillés × coût horaire.
 * Retourne `undefined` si la question n'a pas de réponse.
 */
export function hiddenCost(content: Content, answers: Answers, hourlyRate?: number): HiddenCost | undefined {
  const cfg = content.settings.hiddenCost;
  const choice = selected(answers, cfg.question)[0];
  if (choice === undefined) return undefined;
  const hoursPerMonth = cfg.hoursPerMonth[choice] ?? 0;
  const rate =
    hourlyRate !== undefined && Number.isFinite(hourlyRate) && hourlyRate > 0 ? hourlyRate : cfg.defaultHourlyRate;
  const hoursPerYear = hoursPerMonth * cfg.monthsPerYear;
  const yearlyCost = Math.round((hoursPerYear * rate) / cfg.roundTo) * cfg.roundTo;
  return { hoursPerMonth, hoursPerYear, hourlyRate: rate, yearlyCost };
}
