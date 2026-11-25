import type { Content } from '../content/schema';

/** Petits mots des listes, propres à chaque langue (ui.yaml : list_and, list_other, list_others). */
export interface ListWords {
  and: string;
  other: string;
  others: string;
}

const FRENCH_WORDS: ListWords = { and: 'et', other: 'autre', others: 'autres' };

export function listWords(content: Content): ListWords {
  const { ui } = content;
  return {
    and: ui.list_and ?? FRENCH_WORDS.and,
    other: ui.list_other ?? FRENCH_WORDS.other,
    others: ui.list_others ?? FRENCH_WORDS.others,
  };
}

/** Liste lisible : « A », « A et B », « A, B et C », « A, B, C et 2 autres » (mots selon la langue). */
export function joinNames(names: readonly string[], words: ListWords = FRENCH_WORDS, max = 3): string {
  if (names.length <= 1) return names[0] ?? '';
  const rest = names.length - max;
  if (rest > 0)
    return `${names.slice(0, max).join(', ')} ${words.and} ${rest} ${rest === 1 ? words.other : words.others}`;
  return `${names.slice(0, -1).join(', ')} ${words.and} ${names[names.length - 1]}`;
}

export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}
