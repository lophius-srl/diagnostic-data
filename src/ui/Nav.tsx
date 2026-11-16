import { content, t } from '../content';

export function Nav() {
  const { links } = content.settings;
  return (
    <header class="nav-wrap">
      <nav class="nav" aria-label="Navigation principale">
        <a class="nav-logo" href={links.site}>
          <img src={`${import.meta.env.BASE_URL}brand/logo.svg`} alt={t('brand')} width="132" height="32" />
        </a>
        <a class="btn btn-primary btn-small" href={links.contact}>
          {t('nav_contact')}
        </a>
      </nav>
    </header>
  );
}
