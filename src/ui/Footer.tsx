import { content, t } from '../content';

/** Pied de page identique à celui de lophius.be (même structure, mêmes liens), plus le lien de confidentialité. */
export function Footer() {
  const { links } = content.settings;
  const site = links.site.replace(/\/+$/, '');
  return (
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-cols">
          <div>
            <p class="footer-name">{t('footer_name')}</p>
            <p class="footer-tagline">{t('footer_tagline')}</p>
            <div class="footer-social">
              <a href={links.linkedin} aria-label={t('footer_linkedin')} rel="noopener" target="_blank">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" aria-hidden="true">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect width="4" height="12" x="2" y="9" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              <a href={`mailto:${links.email}`} aria-label={t('footer_email')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" aria-hidden="true">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </a>
            </div>
          </div>
          <nav aria-labelledby="footer-links-title">
            <p id="footer-links-title" class="footer-links-title">
              {t('footer_links')}
            </p>
            <a href={`${site}/#home`}>{t('footer_home')}</a>
            <a href={`${site}/#about`}>{t('footer_about')}</a>
            <a href={`${site}/#work`}>{t('footer_work')}</a>
            <a href={`${site}/#contact`}>{t('footer_contact')}</a>
          </nav>
        </div>
        <p class="footer-legal">
          {t('footer_legal', { year: new Date().getFullYear() })}
          <span aria-hidden="true"> · </span>
          <a href="#/confidentialite">{t('footer_privacy')}</a>
        </p>
      </div>
    </footer>
  );
}
