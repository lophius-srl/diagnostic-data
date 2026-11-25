import { describe, expect, it } from 'vitest';
import type { Question } from '../src/content/schema';
import { feedbackText, questionText } from '../src/engine/flow';
import { joinNames } from '../src/engine/text';
import { chosenTools, suggestionFor } from '../src/engine/tools';
import { content } from './helpers';

const question = (id: string) => content.questions.find((q) => q.id === id) as Question;

describe('déductions à partir des logiciels cochés', () => {
  it('propose « quelques minutes » quand un logiciel affiche le chiffre d’affaires en temps réel', () => {
    const s = suggestionFor(content, question('ventes_mois'), { outils: ['falco', 'winbooks'] });
    expect(s?.option).toBe('minutes');
    expect(s?.reason).toContain('Falco');
    expect(s?.reason).not.toContain('WinBooks');
  });

  it('ne déduit rien quand aucun logiciel n’a la fonction', () => {
    expect(suggestionFor(content, question('ventes_mois'), { outils: ['excel', 'winbooks'] })).toBeUndefined();
    expect(suggestionFor(content, question('exports'), { outils: ['nesaispas'] })).toBeUndefined();
  });

  it('nomme tous les logiciels concernés', () => {
    const s = suggestionFor(content, question('exports'), { outils: ['odoo', 'exact'] });
    expect(s?.reason).toContain('Odoo et Exact Online');
  });

  it('reconnaît un logiciel unique, sans compter la fiduciaire', () => {
    expect(suggestionFor(content, question('recopie'), { outils: ['odoo', 'fiduciaire'] })?.option).toBe('un_seul');
    expect(suggestionFor(content, question('recopie'), { outils: ['odoo', 'winbooks'] })).toBeUndefined();
    expect(suggestionFor(content, question('recopie'), { outils: ['fiduciaire'] })).toBeUndefined();
  });

  it('chaque fonction déclarée par un outil sert à au moins une déduction', () => {
    const used = new Set(content.questions.flatMap((q) => q.suggest.flatMap((r) => r.capability ?? [])));
    for (const c of new Set(content.tools.flatMap((t) => t.capabilities))) expect(used.has(c), c).toBe(true);
  });
});

describe('textes personnalisés avec les logiciels', () => {
  it('cite les logiciels cochés dans la question, sans la fiduciaire', () => {
    const text = questionText(question('recopie'), { outils: ['odoo', 'winbooks', 'fiduciaire'] }, content);
    expect(text).toBe('Ressaisissez-vous des informations entre Odoo et WinBooks ?');
  });

  it('garde le texte général avec un seul logiciel', () => {
    expect(questionText(question('recopie'), { outils: ['odoo'] }, content)).toBe(question('recopie').text);
  });

  it('cite les logiciels dans le retour d’expert', () => {
    const fb = content.feedbacks.find((f) => f.id === 'outils_nombreux');
    const answers = { outils: ['excel', 'odoo', 'teamleader', 'exact'] };
    expect(fb && feedbackText(content, fb, answers)).toMatch(/^Excel \/ Sheets, Odoo, Teamleader et 1 autre :/);
  });

  it('liste les outils dans l’ordre du catalogue', () => {
    expect(chosenTools(content, { outils: ['shopify', 'odoo'] }).map((t) => t.id)).toEqual(['odoo', 'shopify']);
  });

  it('accorde « autre » au singulier', () => {
    expect(joinNames(['A', 'B', 'C', 'D'])).toBe('A, B, C et 1 autre');
    expect(joinNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C et 2 autres');
    const english = { and: 'and', other: 'other', others: 'others' };
    expect(joinNames(['Odoo', 'WinBooks'], english)).toBe('Odoo and WinBooks');
    expect(joinNames(['A', 'B', 'C', 'D'], english)).toBe('A, B, C and 1 other');
  });
});
