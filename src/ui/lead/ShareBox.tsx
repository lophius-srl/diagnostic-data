import { useState } from 'preact/hooks';
import { content, t } from '../../content';
import type { Answers } from '../../engine/conditions';
import { shareUrl } from '../../lead/share';

/** Partage natif sur téléphone, sinon copie dans le presse-papiers, sinon champ à sélectionner. */
export function ShareBox({ answers, unlocked }: { answers: Answers; unlocked: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const url = shareUrl(content, answers, unlocked);

  const share = async () => {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: t('share_native_title'), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch (error) {
      // Partage annulé par l'utilisateur : rien à faire. Sinon, on affiche le lien à copier.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setState('manual');
    }
  };

  return (
    <section class="card share" aria-labelledby="share-title">
      <h2 id="share-title">{t('share_title')}</h2>
      <p class="muted">{t('share_text')}</p>
      <div class="actions">
        <button type="button" class="btn btn-secondary" onClick={share}>
          {t('share_button')}
        </button>
        <span role="status" class="muted small share-status">
          {state === 'copied' ? t('share_copied') : ''}
        </span>
      </div>
      {state === 'manual' && (
        <label class="share-manual">
          {t('share_copy_label')}
          <input type="text" readOnly value={url} onFocus={(e) => (e.currentTarget as HTMLInputElement).select()} />
        </label>
      )}
    </section>
  );
}
