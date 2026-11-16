import { formatNumber, t } from '../../content';
import type { HiddenCost } from '../../engine/hidden-cost';
import { useCountUp, useRevealOnScroll } from '../motion';

interface Props {
  cost: HiddenCost;
  onRateChange: (rate: number) => void;
}

/** Révélation sobre du coût caché : le montant se compte quand la carte arrive à l'écran. */
export function HiddenCostCard({ cost, onRateChange }: Props) {
  const [ref, visible] = useRevealOnScroll<HTMLElement>();
  const shown = useCountUp(cost.yearlyCost, visible);
  return (
    <section class="card cost-card" ref={ref} aria-labelledby="cost-title">
      <h2 id="cost-title">{t('results_hidden_cost')}</h2>
      <p class={visible ? 'cost-value is-visible' : 'cost-value'}>
        <span aria-hidden="true">{formatNumber(shown)} €</span>
        <span class="sr-only">{formatNumber(cost.yearlyCost)} €</span>
        <span class="cost-unit"> {t('results_hidden_cost_unit')}</span>
      </p>
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
            if (value > 0 && value <= 500) onRateChange(value);
          }}
        />
      </label>
    </section>
  );
}
