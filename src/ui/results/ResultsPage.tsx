import { content, t } from '../../content';
import type { Answers } from '../../engine/conditions';
import { buildDiagnostic } from '../../engine/diagnostic';
import type { RenderedAction } from '../../engine/recommend';
import { useCountUp } from '../motion';
import { HiddenCostCard } from './HiddenCostCard';
import { Radar } from './Radar';

interface Props {
  answers: Answers;
  hourlyRate: number | undefined;
  onRateChange: (rate: number) => void;
  onRestart: () => void;
}

const dimension = (id: string | undefined) => content.dimensions.find((d) => d.id === id);

export function ResultsPage({ answers, hourlyRate, onRateChange, onRestart }: Props) {
  const result = buildDiagnostic(content, answers, hourlyRate === undefined ? {} : { hourlyRate });
  const { score } = result;
  const shownScore = useCountUp(score.global, true);
  const { features } = content.settings;

  return (
    <article class="results">
      {/* ---------- Synthèse ---------- */}
      <header class="results-hero">
        <p class="eyebrow">{t('results_eyebrow')}</p>
        <h1 class="hero-title">
          {t('results_title_light')} <strong>{score.level.label}</strong>
        </h1>
        <div class="score-row">
          <p class="score-value">
            <span class="sr-only">
              {t('results_score')} : {score.global} {t('results_score_unit')}
            </span>
            <span aria-hidden="true">{shownScore}</span>
            <span class="score-unit" aria-hidden="true">
              /100
            </span>
          </p>
          <ol class="level-scale" aria-label={t('results_levels_scale')}>
            {content.levels.map((l) => (
              <li
                key={l.id}
                class={l.id === score.level.id ? 'is-current' : ''}
                aria-current={l.id === score.level.id ? 'step' : undefined}
              >
                {l.label}
              </li>
            ))}
          </ol>
        </div>
        <p class="lead">{result.summary}</p>
        {score.cappedFrom && (
          <p class="muted">
            {t('results_capped', { level: score.cappedFrom.label })} {score.cappedFrom.blockedReason}
          </p>
        )}
      </header>

      {/* ---------- Radar ---------- */}
      <section class="card" aria-labelledby="dims-title">
        <h2 id="dims-title">{t('results_dimensions')}</h2>
        <p class="muted">{t('results_dimensions_intro')}</p>
        <Radar scores={score.dimensions} />
        <div class="dim-columns">
          <DimensionList title={t('results_strengths')} ids={result.strengths.slice(0, 2)} />
          <DimensionList title={t('results_weaknesses')} ids={result.weaknesses} />
        </div>
      </section>

      {/* ---------- Coût caché ---------- */}
      {result.hiddenCost && <HiddenCostCard cost={result.hiddenCost} onRateChange={onRateChange} />}

      {/* ---------- Quick wins ---------- */}
      <section aria-labelledby="qw-title">
        <h2 id="qw-title">{t('results_quick_wins')}</h2>
        <p class="muted">{t('results_quick_wins_intro')}</p>
        <ol class="quick-wins">
          {result.quickWins.map((qw, i) => (
            <QuickWin key={qw.id} action={qw} index={i + 1} />
          ))}
        </ol>
      </section>

      {/* ---------- Feuille de route ---------- */}
      <section aria-labelledby="roadmap-title">
        <h2 id="roadmap-title">{t('results_roadmap')}</h2>
        <p class="muted">{t('results_roadmap_intro')}</p>
        <ol class="roadmap">
          {result.roadmap.map((phase) => (
            <li key={phase.id} class="roadmap-phase">
              <p class="roadmap-label">{phase.label}</p>
              <h3>{phase.title}</h3>
              <ul>
                {phase.actions.map((a) => (
                  <li key={a.id}>{a.title}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Forfaits ---------- */}
      <section aria-labelledby="offers-title">
        <h2 id="offers-title">{t('results_offers')}</h2>
        <p class="muted">{t('results_offers_intro')}</p>
        <div class="offers">
          {result.offers.map((o) => (
            <section key={o.id} class="card offer">
              <h3>{o.title}</h3>
              <p class="offer-why">{o.why}</p>
              <p>{o.summary}</p>
              <ul class="checks">
                {o.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <dl class="offer-meta">
                <div>
                  <dt>{t('results_offer_duration')}</dt>
                  <dd>{o.duration}</dd>
                </div>
                <div>
                  <dt>{t('results_offer_price')}</dt>
                  <dd>{o.price}</dd>
                </div>
              </dl>
              <a class="btn btn-secondary" href={content.settings.links.contact}>
                {t('results_offer_cta')}
              </a>
            </section>
          ))}
        </div>
        {features.chequesEntreprises && (
          <aside class="card cheques">
            <h3>{content.offers.cheques.title}</h3>
            <p>{content.offers.cheques.text}</p>
          </aside>
        )}
      </section>

      <div class="actions">
        <button type="button" class="btn btn-secondary" onClick={onRestart}>
          {t('results_restart')}
        </button>
      </div>
    </article>
  );
}

function DimensionList({ title, ids }: { title: string; ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div>
      <h3>{title}</h3>
      <ul class="dim-notes">
        {ids.map((id) => (
          <li key={id}>
            <strong>{dimension(id)?.label}</strong> : {dimension(id)?.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickWin({ action, index }: { action: RenderedAction; index: number }) {
  return (
    <li class="card quick-win">
      <p class="qw-meta">
        <span class="qw-index">{index}</span>
        <span class="chip">{dimension(action.dimension)?.label}</span>
      </p>
      <h3>{action.title}</h3>
      <p>{action.detail}</p>
      <p class="qw-badges">
        <span>
          {t('results_effort')} : <strong>{t(`level_${action.effort}`)}</strong>
        </span>
        <span>
          {t('results_impact')} : <strong>{t(`level_${action.impact}`)}</strong>
        </span>
      </p>
    </li>
  );
}
