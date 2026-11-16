import { content, t } from '../content';

export function Nav() {
  const { links } = content.settings;
  const skip = (event: MouseEvent) => {
    // Pas de changement d'URL : le fragment (#) sert au routage.
    event.preventDefault();
    const main = document.getElementById('main');
    main?.focus();
    main?.scrollIntoView();
  };
  return (
    <>
      <a class="skip-link" href="#main" onClick={skip}>
        {t('skip_link')}
      </a>
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
    </>
  );
}
