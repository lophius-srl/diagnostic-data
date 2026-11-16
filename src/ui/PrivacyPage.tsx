import { content } from '../content';

export function PrivacyPage() {
  const { privacy } = content;
  return (
    <article class="prose">
      <h1 class="hero-title">{privacy.title}</h1>
      <p class="muted small">{privacy.updated}</p>
      {privacy.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
