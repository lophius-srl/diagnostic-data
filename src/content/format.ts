/**
 * Formats selon la langue (settings.locale) : 4000 euros s'écrit à la française ou à l'anglaise (€4,000).
 * L'espace fine (U+202F) est remplacée par une espace insécable classique : la police du PDF ne l'a pas.
 */
const plainSpaces = (text: string) => text.replace(/\u202f/g, '\u00a0');

export const formatNumber = (locale: string, n: number, maxDecimals = 0): string =>
  plainSpaces(new Intl.NumberFormat(locale, { maximumFractionDigits: maxDecimals }).format(n));

export const formatEuro = (locale: string, n: number): string =>
  plainSpaces(
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n),
  );

export const formatDate = (locale: string, d: Date): string =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
