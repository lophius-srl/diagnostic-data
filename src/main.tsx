import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-700.css';
import { render } from 'preact';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './ui/App';

render(<App />, document.getElementById('app') as HTMLElement);
