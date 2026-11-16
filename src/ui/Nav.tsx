import { useEffect, useState } from 'preact/hooks';
import { content, t } from '../content';

/** Défilement (px) au-delà duquel le bouton « Contact Me » apparaît. */
const SHOW_CTA_AFTER_PX = 400;

export function Nav() {
  const { links } = content.settings;
  const site = links.site.replace(/\/+$/, '');
  const [menuOpen, setMenuOpen] = useState(false);
  // Comme sur lophius.be : « Contact Me » n'apparaît qu'après avoir fait défiler la page.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SHOW_CTA_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
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
            <img
              class="logo-full"
              src={`${import.meta.env.BASE_URL}brand/logo.svg`}
              alt={t('brand')}
              width="113"
              height="40"
            />
            <img
              class="logo-mark"
              src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`}
              alt={t('brand')}
              width="34"
              height="32"
            />
          </a>
          <div class="nav-links">
            <a class="nav-link" href={`${site}/#about`}>
              {t('nav_about')}
            </a>
            <a class="nav-link" href={`${site}/#work`}>
              {t('nav_work')}
            </a>
            {scrolled && (
              <a class="btn btn-primary btn-small nav-cta" href={`${site}/#contact`}>
                {t('nav_contact')}
              </a>
            )}
            <button
              type="button"
              class="nav-burger"
              aria-expanded={menuOpen}
              aria-controls="nav-menu"
              aria-label={t('nav_menu')}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          {menuOpen && (
            <div id="nav-menu" class="nav-menu">
              <a href={`${site}/#about`}>{t('nav_about')}</a>
              <a href={`${site}/#work`}>{t('nav_work')}</a>
            </div>
          )}
        </nav>
      </header>
    </>
  );
}
