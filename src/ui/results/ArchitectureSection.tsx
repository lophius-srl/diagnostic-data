import { useMemo } from 'preact/hooks';
import { content, t } from '../../content';
import { layoutDiagram } from '../../diagram/layout';
import { renderDiagramSvg } from '../../diagram/svg';
import { buildArchitecture, describeDiagram, type ArchDiagram } from '../../engine/architecture';
import type { Answers } from '../../engine/conditions';
import { prefersReducedMotion, useRevealOnScroll } from '../motion';

/** Les deux schémas « Aujourd'hui » et « Cible recommandée », générés à partir des réponses. */
export function ArchitectureSection({ answers, locked }: { answers: Answers; locked: boolean }) {
  const { today, target } = useMemo(() => buildArchitecture(content, answers), [answers]);
  const { legend } = content.architecture;
  return (
    <section aria-labelledby="arch-title">
      <h2 id="arch-title">{t('results_architecture')}</h2>
      <div class="arch-grid">
        <Diagram diagram={today} />
        {locked ? (
          <figure class="card arch arch-locked">
            <figcaption>
              <h3>{target.title}</h3>
              <p class="muted small">{t('gate_locked_target')}</p>
            </figcaption>
            <button type="button" class="btn btn-primary" onClick={goToReportForm}>
              {t('gate_locked_cta')}
            </button>
          </figure>
        ) : (
          <Diagram diagram={target} />
        )}
      </div>
      <p class="arch-legend" aria-hidden="true">
        <span class="legend-auto">{legend.auto}</span>
        <span class="legend-manual">{legend.manual}</span>
      </p>
    </section>
  );
}

/** Fait défiler jusqu'au formulaire et y place le focus (pas d'ancre : le routeur utilise le fragment). */
function goToReportForm() {
  const form = document.getElementById('rapport');
  form?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  form?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
}

function Diagram({ diagram }: { diagram: ArchDiagram }) {
  const [ref, visible] = useRevealOnScroll<HTMLElement>();
  const svg = useMemo(
    () =>
      renderDiagramSvg(layoutDiagram(diagram), {
        id: `arch-${diagram.id}`,
        title: diagram.title,
        description: describeDiagram(content, diagram),
        animated: true,
      }),
    [diagram],
  );
  return (
    <figure class={visible ? 'card arch is-visible' : 'card arch'} ref={ref}>
      <figcaption>
        <h3>{diagram.title}</h3>
      </figcaption>
      {/* SVG généré par notre propre moteur, textes échappés (escapeXml). */}
      <div class="arch-svg" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
}
