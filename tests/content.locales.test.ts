import { describe, expect, it } from 'vitest';
import { formatEuro, formatNumber } from '../src/content/format';
import { loadContent } from '../src/content/load-node';
import { pickLocale } from '../src/content/locale';
import type { Content } from '../src/content/schema';
import { countWords } from './helpers';

const fr = loadContent('fr');
const en = loadContent('en');

/** Champs de texte libres : seuls à pouvoir différer d'une langue à l'autre. */
const TEXT_KEYS = new Set([
  'label',
  'text',
  'hint',
  'reason',
  'section',
  'title',
  'detail',
  'summary',
  'why',
  'value',
  'name',
  'shortName',
  'description',
  'phrase',
  'technicalLabel',
  'technicalExplanation',
  'low',
  'mid',
  'high',
  'blockedReason',
  'duration',
  'price',
  'subtitle',
  'unknownTools',
  'auto',
  'manual',
  'detailManual',
  'detailAuto',
  'term',
  'definition',
  'locale',
]);
/** Blocs entièrement rédactionnels. */
const TEXT_BLOCKS = new Set(['ui', 'privacy', 'report', 'home', 'deliverables', 'paragraphs']);

/** Squelette d'un contenu : identifiants, scores, conditions et réglages, sans les textes. */
function skeleton(value: unknown, key = ''): unknown {
  if (TEXT_BLOCKS.has(key)) return '<texte>';
  if (typeof value === 'string') return TEXT_KEYS.has(key) ? '<texte>' : value;
  if (Array.isArray(value)) return value.map((v) => skeleton(v, key));
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, skeleton(v, k)]));
  return value;
}

describe('versions française et anglaise', () => {
  it('ont exactement la même structure : questions, scores, règles, réglages', () => {
    for (const key of Object.keys(fr) as (keyof Content)[]) {
      expect(skeleton(en[key], key), key).toEqual(skeleton(fr[key], key));
    }
  });

  it('ont les mêmes textes d’interface et les mêmes trous', () => {
    expect(Object.keys(en.ui).sort()).toEqual(Object.keys(fr.ui).sort());
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(fr.ui)) expect(holes(en.ui[k] ?? ''), k).toEqual(holes(fr.ui[k] ?? ''));
  });

  it('ne laissent aucun texte français dans la version anglaise', () => {
    const french = /[àâçéèêëîïôûù]|\b(les|des|vos|votre|chiffres)\b/i;
    const texts = JSON.stringify({ ...en, privacy: undefined, offers: { ...en.offers, cheques: undefined } });
    const tools = new Set(en.tools.map((t) => t.name));
    const leftovers = [...texts.matchAll(/"([^"]{3,})"/g)]
      .map((m) => m[1] as string)
      .filter((s) => french.test(s) && !tools.has(s));
    expect(leftovers).toEqual([]);
  });
});

describe('règles de rédaction en anglais', () => {
  const FORBIDDEN = [
    /\bkpis?\b/i,
    /\bindicators?\b/i,
    /\bconnectors?\b/i,
    /\berp\b/i,
    /\bgdpr\b/i,
    /\bmaturity\b/i,
    /\bdata sources?\b/i,
    /\bgovernance\b/i,
  ];
  for (const q of en.questions) {
    it(`${q.id} : 15 mots maximum, sans jargon`, () => {
      for (const text of [q.text, ...q.textVariants.map((v) => v.text)]) {
        expect(countWords(text), text).toBeLessThanOrEqual(15);
      }
      for (const text of [q.text, q.hint ?? '', ...q.options.map((o) => o.label)]) {
        expect(FORBIDDEN.filter((re) => re.test(text)).map(String), text).toEqual([]);
      }
    });
  }
});

describe('choix de la langue', () => {
  it('l’anglais par défaut, puis le choix mémorisé, puis le paramètre d’adresse', () => {
    expect(pickLocale('', null)).toBe('en');
    expect(pickLocale('', 'fr')).toBe('fr');
    expect(pickLocale('?lang=en', 'fr')).toBe('en');
    expect(pickLocale('?lang=fr', null)).toBe('fr');
    expect(pickLocale('?lang=de', 'xx')).toBe('en');
  });
});

describe('formats', () => {
  it('écrit les montants à la française ou à l’anglaise', () => {
    expect(formatEuro('fr-BE', 4000)).toBe('4 000 €');
    expect(formatEuro('en-IE', 4000)).toBe('€4,000');
    expect(formatNumber('en-IE', 15500)).toBe('15,500');
  });
});
