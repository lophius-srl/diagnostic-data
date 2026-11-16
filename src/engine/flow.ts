import type { Content, Feedback, Question } from '../content/schema';
import { evaluate, factsOf, type Answers } from './conditions';

/**
 * Questions visibles, dans l'ordre, compte tenu des réponses déjà données.
 * Les conditions ne portent que sur des questions antérieures (vérifié par validateContent),
 * donc la liste est stable une fois les questions précédentes répondues.
 */
export function visibleQuestions(content: Content, answers: Answers): Question[] {
  return content.questions.filter((q) => !q.showIf || evaluate(q.showIf, answers));
}

/** Première question visible sans réponse, ou `undefined` si le parcours est terminé. */
export function nextQuestion(content: Content, answers: Answers): Question | undefined {
  return visibleQuestions(content, answers).find((q) => answers[q.id] === undefined);
}

/** Ne garde que les réponses des questions encore visibles (une réponse modifiée peut masquer une question). */
export function effectiveAnswers(content: Content, answers: Answers): Answers {
  const result: Record<string, string | readonly string[]> = {};
  for (const q of visibleQuestions(content, answers)) {
    const value = answers[q.id];
    if (value !== undefined) result[q.id] = value;
  }
  return result;
}

/** Texte à afficher pour une question (variante éventuelle selon les réponses précédentes). */
export function questionText(question: Question, answers: Answers): string {
  return question.textVariants.find((v) => evaluate(v.when, answers))?.text ?? question.text;
}

export interface Progress {
  answered: number;
  total: number;
}

export function progress(content: Content, answers: Answers): Progress {
  const visible = visibleQuestions(content, answers);
  return { answered: visible.filter((q) => answers[q.id] !== undefined).length, total: visible.length };
}

/**
 * Retour d'expert à afficher juste après la réponse à `questionId`.
 * `lastShownAt` : position (dans le parcours visible) du dernier retour affiché, ou -Infinity.
 * Au plus un retour toutes les `feedbackMinGap` questions, le plus prioritaire.
 */
export function feedbackAfter(
  content: Content,
  answers: Answers,
  questionId: string,
  lastShownAt: number,
): { feedback: Feedback; position: number } | undefined {
  const position = visibleQuestions(content, answers).findIndex((q) => q.id === questionId);
  if (position < 0 || position - lastShownAt < content.settings.feedbackMinGap) return undefined;
  const facts = factsOf(content, answers);
  const candidates = content.feedbacks
    .filter((f) => f.after === questionId && evaluate(f.when, answers, facts))
    .sort((a, b) => b.priority - a.priority);
  const feedback = candidates[0];
  return feedback ? { feedback, position } : undefined;
}
