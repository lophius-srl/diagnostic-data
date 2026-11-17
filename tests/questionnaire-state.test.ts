import { describe, expect, it } from 'vitest';
import { visibleQuestions } from '../src/engine/flow';
import { emptyProgress } from '../src/storage/progress';
import {
  currentQuestion,
  isComplete,
  questionnaireReducer,
  type QuestionnaireAction,
  type QuestionnaireState,
} from '../src/ui/questionnaire-state';
import { content, profiles } from './helpers';

const reduce = questionnaireReducer(content);
const initial = (): QuestionnaireState => ({ ...emptyProgress(content), pendingFeedback: null });

/** Rejoue un profil en répondant question par question, comme un utilisateur. */
function play(answers: Record<string, string | readonly string[]>): QuestionnaireState {
  let state = initial();
  for (let guard = 0; guard < 50 && !isComplete(content, state); guard++) {
    const action: QuestionnaireAction = state.pendingFeedback
      ? { type: 'continue' }
      : {
          type: 'answer',
          questionId: currentQuestion(content, state)!.id,
          value: answers[currentQuestion(content, state)!.id]!,
        };
    state = reduce(state, action);
  }
  return state;
}

describe('questionnaire', () => {
  it('rejoue chaque profil jusqu’au bout avec les mêmes réponses', () => {
    for (const p of profiles) {
      const end = play(p.answers);
      expect(isComplete(content, end), p.file).toBe(true);
      expect(end.answers).toEqual(p.answers);
      expect(end.seenFeedbacks.length).toBeGreaterThan(0);
    }
  });

  it('affiche un retour d’expert puis avance après « Continuer »', () => {
    let s = initial();
    s = reduce(s, { type: 'answer', questionId: 'outils', value: ['excel', 'winbooks'] });
    s = reduce(s, { type: 'answer', questionId: 'recopie', value: 'souvent' });
    expect(s.pendingFeedback).toBe('recopie_souvent');
    const cursor = s.cursor;
    s = reduce(s, { type: 'continue' });
    expect(s.cursor).toBe(cursor + 1);
  });

  it('ne réaffiche pas un retour déjà vu en revenant en arrière', () => {
    let s = initial();
    for (const [q, v] of [
      ['outils', ['excel', 'winbooks']],
      ['recopie', 'souvent'],
    ] as const) {
      s = reduce(s, { type: 'answer', questionId: q, value: v });
    }
    s = reduce(s, { type: 'continue' });
    s = reduce(s, { type: 'back' });
    s = reduce(s, { type: 'answer', questionId: 'recopie', value: 'souvent' });
    expect(s.pendingFeedback).toBeNull();
  });

  it('revient en arrière sans descendre sous zéro', () => {
    expect(reduce(initial(), { type: 'back' }).cursor).toBe(0);
  });

  it('recalcule le parcours si une réponse antérieure change', () => {
    let s = play(profiles.find((p) => p.file === 'negoce-12.yaml')!.answers);
    const before = visibleQuestions(content, s.answers).map((q) => q.id);
    s = { ...s, cursor: 2 };
    s = reduce(s, { type: 'answer', questionId: 'outils', value: ['winbooks'] });
    const after = visibleQuestions(content, s.answers).map((q) => q.id);
    expect(before).toContain('personne_excel');
    expect(after).toContain('autonomie');
    expect(after).not.toContain('personne_excel');
    expect(after).toHaveLength(before.length);
  });
});
