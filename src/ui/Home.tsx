import { content, t } from '../content';

interface Props {
  canResume: boolean;
  onStart: () => void;
  onResume: () => void;
}

/** Accueil court et centré, sur le modèle de lophius.be : promesse, bouton, trois bénéfices, qui je suis. */
export function Home({ canResume, onStart, onResume }: Props) {
  const { hero, benefits, about, testimonials } = content.home;
  const showTestimonials = content.settings.features.testimonials && testimonials.items.length > 0;

  return (
    <div class="home">
      <section class="home-hero" aria-labelledby="home-title">
        <p class="eyebrow">{hero.eyebrow}</p>
        <h1 id="home-title" class="home-title" tabIndex={-1}>
          {hero.titleLight}
          <strong>{hero.titleStrong}</strong>
        </h1>
        <p class="lead">{hero.lead}</p>
        <div class="actions actions-center">
          {canResume && (
            <button type="button" class="btn btn-primary" onClick={onResume}>
              {t('resume_button')}
            </button>
          )}
          <button type="button" class={canResume ? 'btn btn-secondary' : 'btn btn-primary btn-large'} onClick={onStart}>
            {canResume ? t('restart_button') : t('start_button')}
          </button>
        </div>
        <p class="muted small">{fill(hero.meta, { minutes: content.settings.estimatedMinutes })}</p>
        <p class="muted small">{hero.reassurance}</p>
      </section>

      <ul class="benefits" aria-label={hero.eyebrow}>
        {benefits.map((b) => (
          <li key={b.title}>
            <strong>{b.title}</strong>
            <span class="muted">{b.text}</span>
          </li>
        ))}
      </ul>

      {showTestimonials && (
        <section aria-labelledby="testimonials-title">
          <h2 id="testimonials-title">{testimonials.title}</h2>
          <div class="testimonials">
            {testimonials.items.map((q) => (
              <figure key={q.name} class="card testimonial">
                <blockquote>{q.quote}</blockquote>
                <figcaption>
                  <strong>{q.name}</strong>
                  <span class="muted"> · {q.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section class="about" aria-labelledby="about-title">
        <img
          class="about-photo"
          src={`${import.meta.env.BASE_URL}${about.photo}`}
          alt={about.photoAlt}
          width="160"
          height="160"
          loading="lazy"
        />
        <div>
          <h2 id="about-title" class="about-title">
            {about.titleLight}
            <strong>{about.name}</strong>
          </h2>
          {about.bio.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <a href={content.settings.links.site}>{about.link}</a>
        </div>
      </section>
    </div>
  );
}

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
