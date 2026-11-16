import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-700.css';
import { render } from 'preact';
import './styles/tokens.css';
import './styles/app.css';
import { content } from './content';
import { App } from './ui/App';

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
