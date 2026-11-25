import { content, t } from '../../content';
import type { Answers } from '../../engine/conditions';
import { buildDiagnostic, type DiagnosticResult } from '../../engine/diagnostic';
import type { RenderedAction } from '../../engine/recommend';
import { LeadForm } from '../lead/LeadForm';
import { PdfButton } from '../lead/PdfButton';
import { ShareBox } from '../lead/ShareBox';
import { insightFor } from '../../engine/scoring';
import { useCountUp } from '../motion';
import { ArchitectureSection } from './ArchitectureSection';
import { HiddenCostCard } from './HiddenCostCard';
import { Radar } from './Radar';

interface Props {
  answers: Answers;
  hourlyRate: number | undefined;
  onRateChange: (rate: number) => void;
  onRestart: () => void;
  /** Rapport complet débloqué (coordonnées envoyées, ou lien partagé après déblocage). */
  unlocked: { firstName: string; company?: string } | undefined;
  /** Absent en mode « lien partagé » : pas de formulaire, on invite à faire son propre diagnostic. */
  onUnlock?: (firstName: string, company: string) => void;
  /** Texte d'avertissement en haut de page (mode partagé). */
  banner?: string[];
}

const dimension = (id: string | undefined) => content.dimensions.find((d) => d.id === id);

/** Lien de prise de rendez-vous, ou la page contact tant qu'il n'est pas configuré. */
export const bookingLink = () =>
  content.settings.links.booking.startsWith('[[') ? content.settings.links.contact : content.settings.links.booking;

export function ResultsPage({ answers, hourlyRate, onRateChange, onRestart, unlocked, onUnlock, banner }: Props) {
  const result = buildDiagnostic(content, answers, hourlyRate === undefined ? {} : { hourlyRate });
  const { score } = result;
  const shownScore = useCountUp(score.global, true);
  const locked = content.settings.features.leadGate && !unlocked;
  const shared = onUnlock === undefined;

  return (
    <article class="results">
      {banner && banner.length > 0 && (
        <aside class="notice shared-banner">
          {banner.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <button type="button" class="btn btn-primary btn-small" onClick={onRestart}>
            {t('shared_own_cta')}
          </button>
        </aside>
      )}

      {/* ---------- Verdict ---------- */}
      <header class="results-hero">
        <p class="eyebrow">{t('results_eyebrow')}</p>
        <h1 class="hero-title" tabIndex={-1}>
          {t('results_title_light')}
          <strong>{score.level.label}</strong>
        </h1>
        <p class="score-value">
          <span class="sr-only">{t('results_score_sr', { score: score.global })}</span>
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
        <p class="lead">{result.summary}</p>
        {score.cappedFrom && (
          <p class="muted small">
            {t('results_capped', { level: score.cappedFrom.label })} {score.cappedFrom.blockedReason}
          </p>
        )}
      </header>

      {/* ---------- Radar et coût caché ---------- */}
      <div class="results-grid">
        <section class="card" aria-labelledby="dims-title">
          <h2 id="dims-title">{t('results_dimensions')}</h2>
          <Radar scores={score.dimensions} />
        </section>
        {result.hiddenCost && <HiddenCostCard cost={result.hiddenCost} onRateChange={onRateChange} />}
      </div>

      {/* ---------- Lecture axe par axe ---------- */}
      <section aria-labelledby="reading-title">
        <h2 id="reading-title">{t('results_reading')}</h2>
        <ul class="reading">
          {content.dimensions.map((d) => {
            const value = score.dimensions.find((x) => x.id === d.id)?.score ?? null;
            return (
              <li key={d.id}>
                <p class="reading-head">
                  <strong>{d.label}</strong>
                  <span class="reading-score">{value === null ? t('results_not_evaluated') : `${value}/100`}</span>
                </p>
                <span class="reading-bar" aria-hidden="true">
                  <span style={{ width: `${value ?? 0}%` }} />
                </span>
                <p class="muted small">{insightFor(d, value)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <ArchitectureSection answers={answers} locked={locked} />

      {/* ---------- 3 actions ---------- */}
      <section aria-labelledby="qw-title">
        <h2 id="qw-title">{t('results_quick_wins')}</h2>
        <ol class="quick-wins">
          {result.quickWins.map((qw, i) => (
            <QuickWin key={qw.id} action={qw} index={i + 1} locked={locked} />
          ))}
        </ol>
      </section>

      {/* ---------- Déblocage ---------- */}
      {locked && !shared && (
        <section class="gate" id="rapport" aria-labelledby="gate-title">
          <h2 id="gate-title" class="section-title">
            {t('gate_title')}
          </h2>
          <p class="section-subtitle">{t('gate_intro')}</p>
          <LeadForm answers={answers} hourlyRate={hourlyRate} onSuccess={onUnlock} />
        </section>
      )}
      {unlocked && !shared && (
        <section class="card thanks" aria-labelledby="thanks-title" tabIndex={-1} id="merci">
          <h2 id="thanks-title">{t('lead_thanks_title', { firstName: unlocked.firstName })}</h2>
          <p class="muted">{t('lead_thanks_text')}</p>
          <div class="actions">
            <a class="btn btn-primary" href={bookingLink()} target="_blank" rel="noopener">
              {t('lead_booking')}
            </a>
            <PdfButton
              answers={answers}
              {...(unlocked.company && { company: unlocked.company })}
              hourlyRate={hourlyRate}
              bookingUrl={bookingLink()}
            />
          </div>
        </section>
      )}

      {!locked && <FullReport result={result} />}
      {!locked && shared && <PdfButton answers={answers} hourlyRate={hourlyRate} bookingUrl={bookingLink()} />}

      <footer class="results-footer">
        <ShareBox answers={answers} unlocked={!locked} />
        <button type="button" class="link-button" onClick={onRestart}>
          {shared ? t('shared_own_cta') : t('results_restart')}
        </button>
      </footer>
    </article>
  );
}

/** Feuille de route et forfaits : réservés au rapport complet. */
function FullReport({ result }: { result: DiagnosticResult }) {
  const { features } = content.settings;
  return (
    <>
      <section aria-labelledby="roadmap-title">
        <h2 id="roadmap-title">{t('results_roadmap')}</h2>
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

      <section aria-labelledby="offers-title">
        <h2 id="offers-title">{t('results_offers')}</h2>
        <div class="offers">
          {result.offers.map((o) => (
            <section key={o.id} class="card offer">
              <h3>{o.title}</h3>
              <p class="offer-why">{o.why}</p>
              <p class="small">{o.summary}</p>
              <p class="muted small">
                {o.duration} · {o.price}
              </p>
              <a class="btn btn-secondary btn-small" href={bookingLink()} target="_blank" rel="noopener">
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
    </>
  );
}

function QuickWin({ action, index, locked }: { action: RenderedAction; index: number; locked: boolean }) {
  return (
    <li class="card quick-win">
      <span class="qw-index" aria-hidden="true">
        {index}
      </span>
      <div>
        <h3>{action.title}</h3>
        {!locked && <p>{action.detail}</p>}
        <p class="qw-badges">
          <span class="chip">{dimension(action.dimension)?.label}</span>
          <span>
            {t('results_effort')} <strong>{t(`level_${action.effort}`)}</strong>
          </span>
          <span>
            {t('results_impact')} <strong>{t(`level_${action.impact}`)}</strong>
          </span>
        </p>
      </div>
    </li>
  );
}
