import type { Content } from '../content/schema';
import type { Answers } from '../engine/conditions';
import { sanitizeAnswers } from '../storage/progress';

/**
 * Lien de partage : les réponses sont encodées dans le fragment d'URL (#/r/…), jamais envoyé au serveur.
 * Format : <version>~<réponses>[~u]
 *  - version : contentVersion de la config (les positions des réponses en dépendent) ;
 *  - réponses : une entrée par question, séparées par « . » ; choix unique = position en base 36,
 *    choix multiples = masque de bits en base 36, « - » = pas de réponse ;
 *  - « u » : rapport complet débloqué par l'expéditeur.
 */
export interface SharedResult {
  answers: Answers;
  unlocked: boolean;
  /** Faux si le lien a été créé avec une autre version des questions (décodage au mieux). */
  sameVersion: boolean;
}

const SEP = '~';

export function encodeShare(content: Content, answers: Answers, unlocked: boolean): string {
  const parts = content.questions.map((q) => {
    const value = answers[q.id];
    if (value === undefined) return '-';
    if (typeof value === 'string') {
      const index = q.options.findIndex((o) => o.id === value);
      return index < 0 ? '-' : index.toString(36);
    }
    let mask = 0n;
    q.options.forEach((o, i) => {
      if (value.includes(o.id)) mask |= 1n << BigInt(i);
    });
    return mask === 0n ? '-' : mask.toString(36);
  });
  const code = [encodeURIComponent(content.settings.contentVersion), parts.join('.').replace(/(\.-)+$/, '')];
  if (unlocked) code.push('u');
  return code.join(SEP);
}

export function decodeShare(content: Content, code: string): SharedResult | undefined {
  const [version, body, flag] = code.split(SEP);
  if (version === undefined || body === undefined || body.length > 400) return undefined;
  const parts = body.split('.');
  const raw: Record<string, string | string[]> = {};
  content.questions.forEach((q, i) => {
    const part = parts[i];
    if (part === undefined || part === '-' || !/^[0-9a-z]+$/.test(part)) return;
    if (q.type === 'single') {
      const option = q.options[parseInt(part, 36)];
      if (option) raw[q.id] = option.id;
      return;
    }
    let mask: bigint;
    try {
      mask = parseBase36(part);
    } catch {
      return;
    }
    raw[q.id] = q.options.filter((_, j) => (mask >> BigInt(j)) & 1n).map((o) => o.id);
  });
  const answers = sanitizeAnswers(content, raw);
  if (Object.keys(answers).length === 0) return undefined;
  return {
    answers,
    unlocked: flag === 'u',
    sameVersion: safeDecode(version) === content.settings.contentVersion,
  };
}

export function shareUrl(content: Content, answers: Answers, unlocked: boolean): string {
  const base = content.settings.links.baseUrl.replace(/\/+$/, '');
  return `${base}/#/r/${encodeShare(content, answers, unlocked)}`;
}

function parseBase36(text: string): bigint {
  let n = 0n;
  for (const ch of text) {
    const digit = parseInt(ch, 36);
    if (Number.isNaN(digit)) throw new Error('base36');
    n = n * 36n + BigInt(digit);
  }
  return n;
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
