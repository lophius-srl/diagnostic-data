import { useEffect, useRef } from 'preact/hooks';
import { t } from '../content';
import type { Feedback } from '../content/schema';

export function FeedbackView({ feedback, onContinue }: { feedback: Feedback; onContinue: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    buttonRef.current?.focus({ preventScroll: true });
  }, [feedback.id]);
  return (
    <section class="feedback card" aria-live="polite">
      <p class="feedback-label">{t('feedback_label')}</p>
      <p class="feedback-text">{feedback.text}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" ref={buttonRef} onClick={onContinue}>
          {t('continue_button')}
        </button>
      </div>
    </section>
  );
}
