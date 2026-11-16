import fr from '../generated/content.fr.json';
import { typeset } from './frenchSpacing';
import type { Content } from './schema';

/** Contenu compilé et validé au build (`npm run content`), mis en forme pour l'affichage. */
export const content = typeset(fr as unknown as Content);

/** Texte d'interface avec remplacement de variables : t('question_counter', { current: 2, total: 14 }). */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const template = content.ui[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

/** Nombre au format belge (« 15 500 », « 3,5 »). */
export const formatNumber = (n: number, maxDecimals = 0): string =>
  new Intl.NumberFormat('fr-BE', { maximumFractionDigits: maxDecimals }).format(n);
