import { content, t } from '../content';

interface Props {
  canResume: boolean;
  onStart: () => void;
  onResume: () => void;
}

/** Accueil minimal de l'étape 1 (la version complète arrive à l'étape 6). */
export function Home({ canResume, onStart, onResume }: Props) {
  return (
    <section class="home">
      <h1 class="hero-title">
        {t('start_title_light')} <strong>{t('start_title_strong')}</strong> {t('start_title_end')}
      </h1>
      <p class="muted">{t('start_duration', { minutes: content.settings.estimatedMinutes })}</p>
      <div class="actions">
        {canResume && (
          <button type="button" class="btn btn-primary" onClick={onResume}>
            {t('resume_button')}
          </button>
        )}
        <button type="button" class={canResume ? 'btn btn-secondary' : 'btn btn-primary'} onClick={onStart}>
          {canResume ? t('restart_button') : t('start_button')}
        </button>
      </div>
    </section>
  );
}
