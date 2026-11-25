import en from '../generated/content.en.json';
import fr from '../generated/content.fr.json';
import { formatEuro as euro, formatNumber as number } from './format';
import { typeset } from './frenchSpacing';
import { pickLocale, storedLocale, type Locale } from './locale';
import type { Content } from './schema';

/** Langue de la page, fixée au chargement (un changement de langue recharge la page). */
export const locale: Locale = typeof window === 'undefined' ? 'en' : pickLocale(window.location.search, storedLocale());

/** Contenu compilé et validé au build (`npm run content`), mis en forme pour l'affichage. */
export const content: Content = locale === 'fr' ? typeset(fr as unknown as Content) : (en as unknown as Content);

/** Texte d'interface avec remplacement de variables : t('question_counter', { current: 2, total: 14 }). */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const template = content.ui[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** Nombre au format de la langue (« 15 500 » ou « 15,500 »). */
export const formatNumber = (n: number, maxDecimals = 0): string => number(content.settings.locale, n, maxDecimals);

/** Montant en euros au format de la langue (« 4 000 € » ou « €4,000 »). */
export const formatEuro = (n: number): string => euro(content.settings.locale, n);
