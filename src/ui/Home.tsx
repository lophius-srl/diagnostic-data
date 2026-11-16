import { content, t } from '../content';

interface Props {
  canResume: boolean;
  onStart: () => void;
  onResume: () => void;
}

export function Home({ canResume, onStart, onResume }: Props) {
  const { hero, benefits, steps, about, reassurance, testimonials } = content.home;
  const showTestimonials = content.settings.features.testimonials && testimonials.items.length > 0;
  const start = (
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
  );

  return (
    <div class="home">
      <section class="home-hero" aria-labelledby="home-title">
        <p class="eyebrow">{hero.eyebrow}</p>
        <h1 id="home-title" class="hero-title home-title" tabIndex={-1}>
          {hero.titleLight} <strong>{hero.titleStrong}</strong>
          {hero.titleEnd}
        </h1>
        <p class="lead">{hero.lead}</p>
        <p class="muted">{t('start_duration', { minutes: content.settings.estimatedMinutes })}</p>
        {start}
      </section>

      <section aria-labelledby="benefits-title">
        <h2 id="benefits-title">{benefits.title}</h2>
        <ul class="benefits">
          {benefits.items.map((b, i) => (
            <li key={b.title} class="card benefit">
              <span class="benefit-index" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps-title">
        <h2 id="steps-title">{steps.title}</h2>
        <ol class="steps">
          {steps.items.map((s) => (
            <li key={s.title}>
              <h3>{s.title}</h3>
              <p class="muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

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

      <section class="card about" aria-labelledby="about-title">
        <img
          class="about-photo"
          src={`${import.meta.env.BASE_URL}${about.photo}`}
          alt={about.photoAlt}
          width="120"
          height="120"
          loading="lazy"
        />
        <div>
          <h2 id="about-title">{about.title}</h2>
          <p class="about-name">
            <strong>{about.name}</strong>
            <br />
            <span class="muted">{about.role}</span>
          </p>
          {about.bio.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <a href={content.settings.links.site}>{about.link}</a>
        </div>
      </section>

      <section class="reassurance" aria-labelledby="reassurance-title">
        <h2 id="reassurance-title">{reassurance.title}</h2>
        <p class="muted">{reassurance.text}</p>
        {start}
      </section>
    </div>
  );
}
