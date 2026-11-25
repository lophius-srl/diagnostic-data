/** Langues du diagnostic. L'anglais est la langue par défaut. */
export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Clé du choix de langue mémorisé dans le navigateur. */
export const LOCALE_STORAGE_KEY = 'lophius-diagnostic-lang';

const isLocale = (value: string | null | undefined): value is Locale =>
  value !== null && value !== undefined && (LOCALES as readonly string[]).includes(value);

/**
 * Langue à afficher : paramètre `?lang=` de l'adresse, sinon le choix mémorisé, sinon l'anglais.
 * Fonction pure (testée) : l'appelant fournit l'adresse et le choix mémorisé.
 */
export function pickLocale(search: string, stored: string | null): Locale {
  const fromUrl = new URLSearchParams(search).get('lang');
  if (isLocale(fromUrl)) return fromUrl;
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

/** Lecture sûre du choix mémorisé (stockage bloqué, navigation privée…). */
export function storedLocale(): string | null {
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Change de langue : mémorise le choix puis recharge la page à la même étape. */
export function switchLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Sans stockage, le paramètre d'adresse suffit.
  }
  const url = new URL(window.location.href);
  url.searchParams.set('lang', locale);
  window.location.assign(url.toString());
}
