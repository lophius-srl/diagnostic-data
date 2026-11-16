import type { Content, Question } from '../content/schema';
import type { Answers } from '../engine/conditions';
import { feedbackAfter, visibleQuestions } from '../engine/flow';
import type { SavedProgress } from '../storage/progress';

export interface QuestionnaireState extends SavedProgress {
  /** Retour d'expert affiché en attente de « Continuer ». */
  pendingFeedback: string | null;
}

export type QuestionnaireAction =
  | { type: 'answer'; questionId: string; value: string | readonly string[] }
  | { type: 'continue' }
  | { type: 'back' }
  | { type: 'restart'; initial: SavedProgress };

/** Logique du questionnaire, sans DOM : testable et rejouable. */
export function questionnaireReducer(content: Content) {
  return (state: QuestionnaireState, action: QuestionnaireAction): QuestionnaireState => {
    switch (action.type) {
      case 'answer': {
        const answers: Answers = { ...state.answers, [action.questionId]: action.value };
        const fb = feedbackAfter(content, answers, action.questionId, state.lastFeedbackAt ?? -Infinity);
        if (fb && !state.seenFeedbacks.includes(fb.feedback.id)) {
          return {
            ...state,
            answers,
            pendingFeedback: fb.feedback.id,
            lastFeedbackAt: fb.position,
            seenFeedbacks: [...state.seenFeedbacks, fb.feedback.id],
          };
        }
        return { ...state, answers, pendingFeedback: null, cursor: state.cursor + 1 };
      }
      case 'continue':
        return { ...state, pendingFeedback: null, cursor: state.cursor + 1 };
      case 'back':
        return { ...state, pendingFeedback: null, cursor: Math.max(0, state.cursor - 1) };
      case 'restart':
        return { ...action.initial, pendingFeedback: null };
    }
  };
}

export function currentQuestion(content: Content, state: QuestionnaireState): Question | undefined {
  return visibleQuestions(content, state.answers)[state.cursor];
}

export function isComplete(content: Content, state: QuestionnaireState): boolean {
  return state.pendingFeedback === null && state.cursor >= visibleQuestions(content, state.answers).length;
}
