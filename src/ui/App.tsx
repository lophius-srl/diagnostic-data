import { useEffect, useMemo, useReducer, useState } from 'preact/hooks';
import { content, t } from '../content';
import { progress } from '../engine/flow';
import { decodeShare } from '../lead/share';
import { createSafeStorage } from '../storage/safe-storage';
import { clearProgress, emptyProgress, loadProgress, saveProgress } from '../storage/progress';
import { FeedbackView } from './FeedbackView';
import { Home } from './Home';
import { Nav } from './Nav';
import { PrivacyPage } from './PrivacyPage';
import { QuestionView } from './QuestionView';
import { ResultsPage } from './results/ResultsPage';
import { currentQuestion, isComplete, questionnaireReducer } from './questionnaire-state';

export type Route =
  | { name: 'home' }
  | { name: 'diagnostic' }
  | { name: 'resultats' }
  | { name: 'confidentialite' }
  | { name: 'partage'; code: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'diagnostic' || path === 'resultats' || path === 'confidentialite') return { name: path };
  if (path.startsWith('r/')) return { name: 'partage', code: path.slice(2) };
  return { name: 'home' };
}

const go = (route: 'home' | 'diagnostic' | 'resultats') => {
  window.location.hash = route === 'home' ? '' : `/${route}`;
};

export function App() {
  const storage = useMemo(() => createSafeStorage(), []);
  const saved = useMemo(() => loadProgress(storage, content), [storage]);
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [state, dispatch] = useReducer(questionnaireReducer(content), {
    ...(saved ?? emptyProgress(content)),
    pendingFeedback: null,
  });
  const [hourlyRate, setHourlyRate] = useState<number | undefined>(saved?.hourlyRate);
  const [unlocked, setUnlocked] = useState<{ firstName: string; company?: string } | undefined>(saved?.unlocked);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const { pendingFeedback: _pending, ...toSave } = state;
    saveProgress(storage, {
      ...toSave,
      ...(hourlyRate !== undefined && { hourlyRate }),
      ...(unlocked && { unlocked }),
    });
  }, [state, hourlyRate, unlocked, storage]);

  const complete = isComplete(content, state);
  useEffect(() => {
    if (route.name === 'diagnostic' && complete) go('resultats');
    if (route.name === 'resultats' && !complete) go('diagnostic');
  }, [route, complete]);

  const restart = () => {
    clearProgress(storage);
    setHourlyRate(undefined);
    setUnlocked(undefined);
    dispatch({ type: 'restart', initial: emptyProgress(content) });
    go('diagnostic');
  };

  const unlock = (firstName: string, company: string) => {
    setUnlocked({ firstName, company });
    requestAnimationFrame(() => document.getElementById('merci')?.focus());
  };

  const question = currentQuestion(content, state);
  const feedback = content.feedbacks.find((f) => f.id === state.pendingFeedback);
  const { total } = progress(content, state.answers);

  return (
    <>
      <Nav />
      <main id="main" class="container">
        {!storage.persistent && route.name === 'diagnostic' && (
          <p class="notice" role="status">
            {t('storage_unavailable')}
          </p>
        )}
        {route.name === 'home' && (
          <Home
            canResume={Object.keys(state.answers).length > 0}
            onStart={restart}
            onResume={() => go(complete ? 'resultats' : 'diagnostic')}
          />
        )}
        {route.name === 'diagnostic' && feedback && (
          <FeedbackView feedback={feedback} onContinue={() => dispatch({ type: 'continue' })} />
        )}
        {route.name === 'diagnostic' && !feedback && question && (
          <QuestionView
            question={question}
            answers={state.answers}
            current={state.cursor + 1}
            total={total}
            onAnswer={(value) => dispatch({ type: 'answer', questionId: question.id, value })}
            onBack={() => dispatch({ type: 'back' })}
          />
        )}
        {route.name === 'resultats' && complete && (
          <ResultsPage
            answers={state.answers}
            hourlyRate={hourlyRate}
            onRateChange={setHourlyRate}
            onRestart={restart}
            unlocked={unlocked}
            onUnlock={unlock}
          />
        )}
        {route.name === 'partage' && <SharedResult code={route.code} onOwn={restart} />}
        {route.name === 'confidentialite' && <PrivacyPage />}
      </main>
    </>
  );
}

/** Résultat reçu par lien : affiché sans toucher à la progression du visiteur. */
function SharedResult({ code, onOwn }: { code: string; onOwn: () => void }) {
  const shared = useMemo(() => decodeShare(content, code), [code]);
  const [rate, setRate] = useState<number | undefined>(undefined);
  if (!shared) {
    return (
      <section class="card">
        <p>{t('shared_invalid')}</p>
        <button type="button" class="btn btn-primary" onClick={onOwn}>
          {t('shared_own_cta')}
        </button>
      </section>
    );
  }
  return (
    <ResultsPage
      answers={shared.answers}
      hourlyRate={rate}
      onRateChange={setRate}
      onRestart={onOwn}
      unlocked={shared.unlocked ? { firstName: '' } : undefined}
      banner={[t('shared_banner'), ...(shared.sameVersion ? [] : [t('shared_old_version')])]}
    />
  );
}
