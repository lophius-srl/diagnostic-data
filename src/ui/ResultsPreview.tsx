import { content, formatNumber, t } from '../content';
import type { Answers } from '../engine/conditions';
import { hiddenCost } from '../engine/hidden-cost';
import { score } from '../engine/scoring';

interface Props {
  answers: Answers;
  hourlyRate: number | undefined;
  onRateChange: (rate: number) => void;
  onRestart: () => void;
}

/** Aperçu des résultats de l'étape 1 : la page complète (radar, schémas, quick wins) arrive à l'étape 2. */
export function ResultsPreview({ answers, hourlyRate, onRateChange, onRestart }: Props) {
  const result = score(content, answers);
  const cost = hiddenCost(content, answers, hourlyRate);
  return (
    <section class="results">
      <p class="muted">{t('results_preview_note')}</p>
      <h1 class="hero-title">
        {t('results_title')} : <strong>{result.level.label}</strong>
      </h1>
      <div class="card score-card">
        <p class="score-value">
          {result.global}
          <span class="muted"> / 100</span>
        </p>
        <p>{result.level.summary}</p>
        {result.cappedFrom && <p class="muted">{result.cappedFrom.blockedReason}</p>}
      </div>

      <h2>{t('results_dimensions')}</h2>
      <ul class="dimension-list">
        {content.dimensions.map((d) => {
          const s = result.dimensions.find((x) => x.id === d.id)?.score ?? null;
          return (
            <li key={d.id}>
              <span class="dimension-name">{d.label}</span>
              <span class="dimension-bar" aria-hidden="true">
                <span style={{ width: `${s ?? 0}%` }} />
              </span>
              <span class="dimension-score">{s === null ? t('results_not_evaluated') : s}</span>
            </li>
          );
        })}
      </ul>

      {cost && (
        <div class="card cost-card">
          <h2>{t('results_hidden_cost')}</h2>
          <p class="cost-value">{formatNumber(cost.yearlyCost)} € / an</p>
          <p class="muted">
            {t('results_hidden_cost_detail', {
              hours: formatNumber(cost.hoursPerYear),
              rate: formatNumber(cost.hourlyRate),
            })}
          </p>
          <label class="rate-field">
            {t('results_hourly_rate')}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={cost.hourlyRate}
              onInput={(e) => {
                const value = Number((e.currentTarget as HTMLInputElement).value);
                if (value > 0) onRateChange(value);
              }}
            />
          </label>
        </div>
      )}

      <div class="actions">
        <button type="button" class="btn btn-secondary" onClick={onRestart}>
          {t('restart_button')}
        </button>
      </div>
    </section>
  );
}
