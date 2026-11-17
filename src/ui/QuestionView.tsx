import { useEffect, useRef, useState } from 'preact/hooks';
import { content, t } from '../content';
import type { Question } from '../content/schema';
import { selected, type Answers } from '../engine/conditions';
import { questionText } from '../engine/flow';
import { suggestionFor } from '../engine/tools';

interface Props {
  question: Question;
  answers: Answers;
  current: number;
  total: number;
  onAnswer: (value: string | readonly string[]) => void;
  onBack: () => void;
}

export function QuestionView({ question, answers, current, total, onAnswer, onBack }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previous = selected(answers, question.id);
  const [draft, setDraft] = useState<readonly string[]>(previous);

  useEffect(() => {
    setDraft(selected(answers, question.id));
    // Chaque question repart du haut de la page, sous la barre de navigation.
    window.scrollTo(0, 0);
    titleRef.current?.focus({ preventScroll: true });
    // On ne réinitialise le brouillon qu'au changement de question.
  }, [question.id]);

  const toggle = (id: string, exclusive: boolean) => {
    if (exclusive) return setDraft(draft.includes(id) ? [] : [id]);
    const withoutExclusive = draft.filter((d) => !question.options.find((o) => o.id === d)?.exclusive);
    setDraft(withoutExclusive.includes(id) ? withoutExclusive.filter((d) => d !== id) : [...withoutExclusive, id]);
  };

  const suggestion = question.type === 'single' ? suggestionFor(content, question, answers) : undefined;
  const percent = Math.round((100 * (current - 1)) / Math.max(total, 1));
  const toolsById = new Map(content.tools.map((tool) => [tool.id, tool]));

  return (
    <section class="question" aria-labelledby="question-title" key={question.id}>
      <div
        class="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t('question_counter', { current, total })}
      >
        <div class="progress-bar" style={{ width: `${percent}%` }} />
      </div>
      <p class="muted counter">{t('question_counter', { current, total })}</p>
      {question.section && <p class="eyebrow">{question.section}</p>}
      <h1 id="question-title" class="question-title" tabIndex={-1} ref={titleRef}>
        {questionText(question, answers, content)}
      </h1>
      {question.hint && <p class="muted question-hint">{question.hint}</p>}

      {suggestion && (
        <aside class="suggestion" aria-labelledby="suggestion-label">
          <p class="suggestion-label" id="suggestion-label">
            <span aria-hidden="true">✦ </span>
            {t('suggestion_label')}
          </p>
          <p class="suggestion-reason">{suggestion.reason}</p>
          <p class="muted small">{t('suggestion_hint')}</p>
        </aside>
      )}

      {question.type === 'single' ? (
        <div class="options" role="group" aria-labelledby="question-title">
          {question.options.map((o) => {
            const suggested = suggestion?.option === o.id;
            return (
              <button
                key={o.id}
                type="button"
                class={suggested ? 'option is-suggested' : 'option'}
                aria-pressed={previous.includes(o.id)}
                aria-describedby={suggested ? 'suggestion-label' : undefined}
                onClick={() => onAnswer(o.id)}
              >
                <span class="option-label">{o.label}</span>
                {suggested && <span class="suggestion-badge">{t('suggestion_badge')}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <fieldset class="options options-multi">
          <legend class="muted">{t('multi_hint')}</legend>
          {question.options.map((o) => {
            const tool = o.tool ? toolsById.get(o.tool) : undefined;
            const checked = draft.includes(o.id);
            return (
              <label key={o.id} class={checked ? 'option option-check is-checked' : 'option option-check'}>
                <input type="checkbox" checked={checked} onChange={() => toggle(o.id, o.exclusive)} />
                {tool?.logo && (
                  <img
                    class="tool-logo"
                    src={`${import.meta.env.BASE_URL}${tool.logo}`}
                    alt=""
                    width="28"
                    height="28"
                  />
                )}
                <span class="option-label">{o.label}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      <div class="actions">
        {current > 1 && (
          <button type="button" class="btn btn-secondary" onClick={onBack}>
            {t('back_button')}
          </button>
        )}
        {question.type !== 'single' && (
          <button type="button" class="btn btn-primary" disabled={draft.length === 0} onClick={() => onAnswer(draft)}>
            {t('next_button')}
          </button>
        )}
      </div>
    </section>
  );
}
