import { describe, expect, it } from 'vitest';
import { content } from './helpers';

/**
 * Règles de rédaction imposées par le brief. Ce test échoue si une question devient trop longue,
 * propose trop de réponses ou utilise du jargon.
 */
const MAX_WORDS = 15;
const MAX_OPTIONS = 4;
const MAX_FEEDBACK_SENTENCES = 2;
const FORBIDDEN = [
  /\bkpis?\b/i,
  /\bindicateurs?\b/i,
  /\bconnecteurs?\b/i,
  /\berp\b/i,
  /\brgpd\b/i,
  /\bmaturités?\b/i,
  /\bsources? de données\b/i,
  /\bgouvernance\b/i,
];

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

const forbiddenIn = (text: string) => FORBIDDEN.filter((re) => re.test(text)).map(String);

describe('règles de rédaction des questions', () => {
  for (const q of content.questions) {
    const texts = [q.text, ...q.textVariants.map((v) => v.text)];

    it(`${q.id} : ${MAX_WORDS} mots maximum`, () => {
      for (const t of texts) expect(countWords(t), t).toBeLessThanOrEqual(MAX_WORDS);
    });

    it(`${q.id} : aucun mot interdit`, () => {
      for (const t of [...texts, ...q.options.map((o) => o.label), q.hint ?? '']) {
        expect(forbiddenIn(t), t).toEqual([]);
      }
    });

    if (q.type !== 'tools') {
      it(`${q.id} : ${MAX_OPTIONS} réponses maximum`, () => {
        expect(q.options.length).toBeLessThanOrEqual(MAX_OPTIONS);
      });
    }
  }

  it('seul le sélecteur d’outils dépasse 4 réponses', () => {
    const long = content.questions.filter((q) => q.options.length > MAX_OPTIONS);
    expect(long.every((q) => q.type === 'tools')).toBe(true);
  });

  it('le sélecteur d’outils propose l’écosystème belge et « Je ne sais pas »', () => {
    const tools = content.questions.find((q) => q.type === 'tools');
    const ids = tools?.options.map((o) => o.id) ?? [];
    for (const id of [
      'excel',
      'odoo',
      'teamleader',
      'exact',
      'winbooks',
      'bob',
      'yuki',
      'billit',
      'sage',
      'shopify',
      'woocommerce',
      'lightspeed',
      'metier',
    ]) {
      expect(ids).toContain(id);
    }
    expect(tools?.options.find((o) => o.id === 'nesaispas')?.exclusive).toBe(true);
  });
});

describe('règles de rédaction des retours d’expert', () => {
  for (const f of content.feedbacks) {
    it(`${f.id} : 2 phrases maximum, sans jargon ni pourcentage`, () => {
      const sentences = f.text.split(/[.!?…]+(?:\s|$)/).filter((s) => s.trim() !== '');
      expect(sentences.length).toBeLessThanOrEqual(MAX_FEEDBACK_SENTENCES);
      expect(forbiddenIn(f.text)).toEqual([]);
      expect(f.text).not.toMatch(/\d+\s?%/);
    });
  }
});

describe('crédibilité du contenu', () => {
  it('aucun repère indicatif actif sans source', () => {
    for (const b of content.benchmarks) if (b.enabled) expect(b.source?.trim()).toBeTruthy();
  });

  it('témoignages et chèques-entreprises désactivés par défaut', () => {
    expect(content.settings.features.testimonials).toBe(false);
    expect(content.settings.features.chequesEntreprises).toBe(false);
  });
});

describe('countWords', () => {
  it('compte les mots avec apostrophes et tirets comme un seul mot', () => {
    expect(countWords("Vous recopiez des infos d'un logiciel à l'autre ?")).toBe(8);
    expect(countWords('Vos ventes arrivent-elles seules ?')).toBe(4);
  });
});

describe('typographie française', () => {
  it('insère une espace insécable avant les signes doubles et dans les guillemets', async () => {
    const { frenchSpacing } = await import('../src/content/frenchSpacing');
    expect(frenchSpacing('Point fort : ok ? « oui »')).toBe('Point fort : ok ? « oui »');
  });
});
