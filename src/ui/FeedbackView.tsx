import { useEffect, useRef } from 'preact/hooks';
import { content, t } from '../content';
import type { Answers } from '../engine/conditions';
import { feedbackText } from '../engine/flow';
import type { Feedback } from '../content/schema';

interface Props {
  feedback: Feedback;
  answers: Answers;
  onContinue: () => void;
}

export function FeedbackView({ feedback, answers, onContinue }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    buttonRef.current?.focus({ preventScroll: true });
  }, [feedback.id]);
  return (
    <section class="feedback card" aria-live="polite">
      <p class="feedback-label">{t('feedback_label')}</p>
      <p class="feedback-text">{feedbackText(content, feedback, answers)}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" ref={buttonRef} onClick={onContinue}>
          {t('continue_button')}
        </button>
      </div>
    </section>
  );
}
