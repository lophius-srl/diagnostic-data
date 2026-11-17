import { content, t } from '../content';
import type { Answers } from '../engine/conditions';
import { score } from '../engine/scoring';
import { Radar } from './results/Radar';

/** Nombre d'axes évalués à partir duquel la forme du radar a du sens. */
const MIN_AXES = 3;

/** Radar des 7 axes recalculé à chaque réponse, affiché à côté des questions sur grand écran. */
export function LiveProfile({ answers }: { answers: Answers }) {
  const { dimensions } = score(content, answers);
  const evaluated = dimensions.filter((d) => d.score !== null).length;
  return (
    <aside class="live-profile card" aria-labelledby="live-profile-title">
      <h2 id="live-profile-title">{t('live_profile_title')}</h2>
      <p class="muted small">{evaluated >= MIN_AXES ? t('live_profile_hint') : t('live_profile_waiting')}</p>
      {evaluated >= MIN_AXES && <Radar scores={dimensions} />}
    </aside>
  );
}
