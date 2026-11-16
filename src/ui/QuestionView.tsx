import { useEffect, useRef, useState } from 'preact/hooks';
import { content, t } from '../content';
import type { Question } from '../content/schema';
import { selected, type Answers } from '../engine/conditions';
import { questionText } from '../engine/flow';

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
    titleRef.current?.focus();
    // On ne réinitialise le brouillon qu'au changement de question.
  }, [question.id]);

  const toggle = (id: string, exclusive: boolean) => {
    if (exclusive) return setDraft(draft.includes(id) ? [] : [id]);
    const withoutExclusive = draft.filter((d) => !question.options.find((o) => o.id === d)?.exclusive);
    setDraft(withoutExclusive.includes(id) ? withoutExclusive.filter((d) => d !== id) : [...withoutExclusive, id]);
  };

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
      <h1 id="question-title" class="question-title" tabIndex={-1} ref={titleRef}>
        {questionText(question, answers)}
      </h1>
      {question.hint && <p class="muted">{question.hint}</p>}

      {question.type === 'single' ? (
        <div class="options" role="group" aria-labelledby="question-title">
          {question.options.map((o) => (
            <button
              key={o.id}
              type="button"
              class="option"
              aria-pressed={previous.includes(o.id)}
              onClick={() => onAnswer(o.id)}
            >
              {o.label}
            </button>
          ))}
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
                {tool?.logo ? (
                  <img
                    class="tool-logo"
                    src={`${import.meta.env.BASE_URL}${tool.logo}`}
                    alt=""
                    width="28"
                    height="28"
                  />
                ) : (
                  <span class="tool-badge" aria-hidden="true">
                    {initials(o.label)}
                  </span>
                )}
                <span>{o.label}</span>
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

function initials(label: string): string {
  return label
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
