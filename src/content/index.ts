import fr from '../generated/content.fr.json';
import type { Content } from './schema';

/** Contenu compilé et validé au build (`npm run content`). */
export const content = fr as unknown as Content;

/** Texte d'interface avec remplacement de variables : t('question_counter', { current: 2, total: 14 }). */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const template = content.ui[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

const numberFormat = new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 });
export const formatNumber = (n: number): string => numberFormat.format(n);
