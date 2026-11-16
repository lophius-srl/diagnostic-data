import { useEffect, useMemo, useReducer, useState } from 'preact/hooks';
import { content, t } from '../content';
import { progress } from '../engine/flow';
import { createSafeStorage } from '../storage/safe-storage';
import { clearProgress, emptyProgress, loadProgress, saveProgress } from '../storage/progress';
import { FeedbackView } from './FeedbackView';
import { Home } from './Home';
import { Nav } from './Nav';
import { QuestionView } from './QuestionView';
import { ResultsPreview } from './ResultsPreview';
import { currentQuestion, isComplete, questionnaireReducer } from './questionnaire-state';

type Route = 'home' | 'diagnostic' | 'resultats';

const routeFromHash = (): Route => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash === 'diagnostic' || hash === 'resultats' ? hash : 'home';
};

const go = (route: Route) => {
  window.location.hash = route === 'home' ? '' : `/${route}`;
};

export function App() {
  const storage = useMemo(() => createSafeStorage(), []);
  const saved = useMemo(() => loadProgress(storage, content), [storage]);
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [state, dispatch] = useReducer(questionnaireReducer(content), {
    ...(saved ?? emptyProgress(content)),
    pendingFeedback: null,
  });
  const [hourlyRate, setHourlyRate] = useState<number | undefined>(saved?.hourlyRate);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const { pendingFeedback: _pending, ...toSave } = state;
    saveProgress(storage, { ...toSave, ...(hourlyRate !== undefined && { hourlyRate }) });
  }, [state, hourlyRate, storage]);

  const complete = isComplete(content, state);
  useEffect(() => {
    if (route === 'diagnostic' && complete) go('resultats');
    if (route === 'resultats' && !complete) go('diagnostic');
  }, [route, complete]);

  const restart = () => {
    clearProgress(storage);
    setHourlyRate(undefined);
    dispatch({ type: 'restart', initial: emptyProgress(content) });
    go('diagnostic');
  };

  const question = currentQuestion(content, state);
  const feedback = content.feedbacks.find((f) => f.id === state.pendingFeedback);
  const { total } = progress(content, state.answers);

  return (
    <>
      <Nav />
      <main id="main" class="container">
        {!storage.persistent && route === 'diagnostic' && (
          <p class="notice" role="status">
            {t('storage_unavailable')}
          </p>
        )}
        {route === 'home' && (
          <Home
            canResume={Object.keys(state.answers).length > 0}
            onStart={restart}
            onResume={() => go(complete ? 'resultats' : 'diagnostic')}
          />
        )}
        {route === 'diagnostic' && feedback && (
          <FeedbackView feedback={feedback} onContinue={() => dispatch({ type: 'continue' })} />
        )}
        {route === 'diagnostic' && !feedback && question && (
          <QuestionView
            question={question}
            answers={state.answers}
            current={state.cursor + 1}
            total={total}
            onAnswer={(value) => dispatch({ type: 'answer', questionId: question.id, value })}
            onBack={() => dispatch({ type: 'back' })}
          />
        )}
        {route === 'resultats' && complete && (
          <ResultsPreview
            answers={state.answers}
            hourlyRate={hourlyRate}
            onRateChange={setHourlyRate}
            onRestart={restart}
          />
        )}
      </main>
    </>
  );
}
