import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-700.css';
import { render } from 'preact';
import './styles/tokens.css';
import './styles/app.css';
import { content, locale, t } from './content';
import { App } from './ui/App';

// Langue du document (lecteurs d'écran, césure) : celle choisie au chargement.
document.documentElement.lang = content.settings.locale;
document.documentElement.dataset.locale = locale;
document.title = t('page_title');
document.querySelector('meta[name="description"]')?.setAttribute('content', t('page_description'));

render(<App />, document.getElementById('app') as HTMLElement);

// Statistiques de visite sans cookie (Cloudflare Web Analytics), uniquement si activées dans settings.yaml.
// Penser à autoriser static.cloudflareinsights.com et cloudflareinsights.com dans public/_headers.
const { features, analyticsToken } = content.settings;
if (features.analytics && analyticsToken) {
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token: analyticsToken });
  document.head.appendChild(script);
}
