import type { Content } from '../content/schema';
import type { Answers } from '../engine/conditions';
import type { SafeStorage } from './safe-storage';

/** État du questionnaire sauvegardé localement pour pouvoir fermer l'onglet et reprendre. */
export interface SavedProgress {
  contentVersion: string;
  answers: Answers;
  /** Position dans le parcours visible. */
  cursor: number;
  /** Position du dernier retour d'expert affiché. */
  lastFeedbackAt: number | null;
  /** Retours déjà affichés (pas de répétition en revenant en arrière). */
  seenFeedbacks: string[];
  /** Coût horaire personnalisé sur la page de résultats. */
  hourlyRate?: number;
  /** Rapport complet débloqué (coordonnées envoyées), avec le prénom pour le remerciement. */
  unlocked?: { firstName: string };
}

export const STORAGE_KEY = 'lophius-diagnostic';

export function emptyProgress(content: Content): SavedProgress {
  return {
    contentVersion: content.settings.contentVersion,
    answers: {},
    cursor: 0,
    lastFeedbackAt: null,
    seenFeedbacks: [],
  };
}

export function saveProgress(storage: SafeStorage, progress: SavedProgress): void {
  storage.set(STORAGE_KEY, JSON.stringify(progress));
}

export function clearProgress(storage: SafeStorage): void {
  storage.remove(STORAGE_KEY);
}

/**
 * Relit la progression. Toute donnée illisible ou obsolète est ignorée sans erreur :
 * on ne garde que les réponses qui existent encore dans le contenu actuel.
 */
export function loadProgress(storage: SafeStorage, content: Content): SavedProgress | undefined {
  const raw = storage.get(STORAGE_KEY);
  if (!raw) return undefined;
  let data: Partial<SavedProgress>;
  try {
    data = JSON.parse(raw) as Partial<SavedProgress>;
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null) return undefined;

  const answers = sanitizeAnswers(content, data.answers);
  if (Object.keys(answers).length === 0) return undefined;
  const sameVersion = data.contentVersion === content.settings.contentVersion;
  return {
    contentVersion: content.settings.contentVersion,
    answers,
    cursor: sameVersion && Number.isInteger(data.cursor) ? Math.max(0, data.cursor as number) : 0,
    lastFeedbackAt: sameVersion && typeof data.lastFeedbackAt === 'number' ? data.lastFeedbackAt : null,
    seenFeedbacks: Array.isArray(data.seenFeedbacks) ? data.seenFeedbacks.filter((s) => typeof s === 'string') : [],
    ...(typeof data.hourlyRate === 'number' && data.hourlyRate > 0 && { hourlyRate: data.hourlyRate }),
    ...(sameVersion &&
      typeof data.unlocked?.firstName === 'string' && {
        unlocked: { firstName: data.unlocked.firstName.slice(0, 60) },
      }),
  };
}

export function sanitizeAnswers(content: Content, input: unknown): Answers {
  if (typeof input !== 'object' || input === null) return {};
  const result: Record<string, string | string[]> = {};
  for (const q of content.questions) {
    const value = (input as Record<string, unknown>)[q.id];
    const valid = new Set(q.options.map((o) => o.id));
    if (q.type === 'single' && typeof value === 'string' && valid.has(value)) result[q.id] = value;
    if (q.type !== 'single' && Array.isArray(value)) {
      const kept = value.filter((v): v is string => typeof v === 'string' && valid.has(v));
      if (kept.length > 0) result[q.id] = [...new Set(kept)];
    }
  }
  return result;
}
