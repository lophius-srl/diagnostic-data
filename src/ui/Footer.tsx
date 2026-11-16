import { content, t } from '../content';

export function Footer() {
  const { links } = content.settings;
  return (
    <footer class="footer">
      <div class="footer-inner">
        <p class="footer-tagline">{t('footer_tagline')}</p>
        <nav aria-label="Liens Lophius">
          <a href={links.site}>{t('footer_site')}</a>
          <a href={links.contact}>{t('footer_contact')}</a>
          <a href="#/confidentialite">{t('footer_privacy')}</a>
        </nav>
        <p class="footer-legal">{t('footer_legal', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
