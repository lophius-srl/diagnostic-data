import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare, shareUrl } from '../src/lead/share';
import { EMPTY_CONTACT, isValidPhone, normalizeBce, normalizeContact, validateLead } from '../src/lead/validate';
import { brevoSender } from '../src/server/brevo';
import { d1Store, type D1Like } from '../src/server/d1-store';
import { readableAnswers } from '../src/server/lead-email';
import { handleLead, type LeadDeps, type LeadRecord, type LeadStore } from '../src/server/lead-handler';
import type { EmailMessage } from '../src/server/lead-email';
import { content, profile, profiles, simulatedAnswers } from './helpers';

const CONTACT = {
  firstName: 'Marie',
  lastName: 'Dupont',
  email: 'marie@exemple.be',
  company: 'Négoce Dupont SRL',
  bce: '0123.456.749',
  phone: '+32 4 123 45 67',
};

describe('validation des coordonnées', () => {
  it('accepte un formulaire complet', () => {
    expect(validateLead(CONTACT, true)).toEqual({});
  });

  it('exige prénom, nom, entreprise, e-mail valide et consentement', () => {
    const errors = validateLead({ ...EMPTY_CONTACT, email: 'pas-un-email' }, false);
    expect(Object.keys(errors).sort()).toEqual(['company', 'consent', 'email', 'firstName', 'lastName']);
    expect(errors.email).toBe('lead_error_email');
  });

  it('BCE et téléphone sont facultatifs mais vérifiés s’ils sont remplis', () => {
    expect(validateLead({ ...CONTACT, bce: '', phone: '' }, true)).toEqual({});
    expect(validateLead({ ...CONTACT, bce: '0123.456.789' }, true).bce).toBe('lead_error_bce');
    expect(validateLead({ ...CONTACT, phone: 'abc' }, true).phone).toBe('lead_error_phone');
  });

  it('contrôle le numéro BCE (modulo 97) et le normalise', () => {
    expect(normalizeBce('0123456749')).toBe('0123.456.749');
    expect(normalizeBce('BE 0123.456.749')).toBe('0123.456.749');
    expect(normalizeBce('123456749')).toBe('0123.456.749');
    expect(normalizeBce('0123.456.748')).toBeUndefined();
    expect(normalizeBce('2123456749')).toBeUndefined();
  });

  it('accepte les formats de téléphone belges courants', () => {
    expect(isValidPhone('04 123 45 67')).toBe(true);
    expect(isValidPhone('+32 (0)4/123.45.67')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
  });

  it('nettoie les entrées (espaces, caractères de contrôle, longueur, e-mail en minuscules)', () => {
    const c = normalizeContact({ firstName: '  Ma\u0000rie  ', email: ' Marie@Exemple.BE ', company: 'x'.repeat(500) });
    expect(c.firstName).toBe('Ma rie');
    expect(c.email).toBe('marie@exemple.be');
    expect(c.company.length).toBe(120);
    expect(normalizeContact(null)).toEqual(EMPTY_CONTACT);
  });
});

describe('lien de partage', () => {
  it('restitue exactement les réponses (3 000 parcours)', () => {
    for (const answers of simulatedAnswers(3000, 11)) {
      const decoded = decodeShare(content, encodeShare(content, answers, false));
      expect(decoded?.answers).toEqual(answers);
      expect(decoded?.unlocked).toBe(false);
      expect(decoded?.sameVersion).toBe(true);
    }
  });

  it('reste court et sans caractère à échapper', () => {
    for (const p of profiles) {
      const code = encodeShare(content, p.answers, true);
      expect(code.length).toBeLessThan(80);
      expect(code).toMatch(/^[\w.~%-]+$/);
      expect(decodeShare(content, code)?.unlocked).toBe(true);
    }
  });

  it('construit l’URL sur la base configurée, réponses dans le fragment (jamais envoyées au serveur)', () => {
    expect(shareUrl(content, profile('negoce-12.yaml').answers, false)).toMatch(
      /^https:\/\/diagnostic\.lophius\.be\/#\/r\//,
    );
  });

  it('ignore un lien abîmé ou malveillant sans planter', () => {
    for (const code of ['', 'x', '2026~', '2026~zz.zz.zz', '%E0%A4%A~0.1', `v~${'9'.repeat(500)}`, 'v~0.<script>']) {
      expect(() => decodeShare(content, code)).not.toThrow();
    }
    expect(decodeShare(content, 'v~')).toBeUndefined();
  });

  it('signale un lien créé avec une autre version des questions', () => {
    const code = encodeShare(content, profile('services-40.yaml').answers, false).replace(/^[^~]+/, 'ancienne');
    expect(decodeShare(content, code)?.sameVersion).toBe(false);
  });
});

/** Base en mémoire qui imite D1. */
function memoryStore(): LeadStore & { rows: LeadRecord[] } {
  const rows: LeadRecord[] = [];
  return {
    rows,
    async countRecent(email, since) {
      return rows.filter((r) => r.contact.email === email && r.createdAt >= since).length;
    },
    async insert(r) {
      rows.push(r);
    },
    async updateEmailStatus(id, status) {
      const row = rows.find((r) => r.id === id);
      if (row) row.emailStatus = status;
    },
  };
}

function setup(overrides: Partial<LeadDeps> = {}) {
  const store = memoryStore();
  const sent: EmailMessage[] = [];
  let n = 0;
  const deps: LeadDeps = {
    content,
    store,
    sendEmail: async (m) => {
      sent.push(m);
    },
    now: () => new Date('2026-11-16T10:00:00Z'),
    newId: () => `lead-${++n}`,
    allowedOrigin: 'https://diagnostic.lophius.be',
    ...overrides,
  };
  return { deps, store, sent };
}

const post = (body: unknown, origin = 'https://diagnostic.lophius.be') =>
  new Request('https://diagnostic.lophius.be/api/lead', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const validBody = (extra: Record<string, unknown> = {}) => ({
  contact: CONTACT,
  consent: true,
  consentVersion: '2026-11-v1',
  answers: profile('negoce-12.yaml').answers,
  elapsedMs: 60_000,
  website: '',
  ...extra,
});

describe('réception d’un lead (/api/lead)', () => {
  it('stocke le lead avec le score recalculé côté serveur et notifie Antoine', async () => {
    const { deps, store, sent } = setup();
    const res = await handleLead(post(validBody({ score: 100 })), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: 'lead-1' });
    const row = store.rows[0]!;
    expect(row.scoreGlobal).toBe(30);
    expect(row.level).toBe('structure');
    expect(row.hiddenCost).toBe(9900);
    expect(row.contact.bce).toBe('0123.456.749');
    expect(row.consentVersion).toBe('2026-11-v1');
    expect(row.emailStatus).toBe('sent');
    expect(sent[0]?.subject).toBe('Nouveau lead diagnostic : Négoce Dupont SRL — Structuré (30/100)');
    expect(sent[0]?.replyTo.email).toBe('marie@exemple.be');
    expect(sent[0]?.text).toMatch(
      /Ressaisissez-vous des informations entre Excel \/ Sheets et WinBooks \? → Oui, régulièrement/,
    );
  });

  it('conserve le lead même si l’e-mail échoue', async () => {
    const errors: string[] = [];
    const { deps, store } = setup({
      sendEmail: async () => {
        throw new Error('Brevo 500');
      },
      logError: (m) => errors.push(m),
    });
    const res = await handleLead(post(validBody()), deps);
    expect(res.status).toBe(200);
    expect(store.rows[0]?.emailStatus).toBe('failed');
    expect(errors[0]).toMatch(/Brevo 500/);
  });

  it('fonctionne sans configuration e-mail (développement local)', async () => {
    const { deps, store } = setup({ sendEmail: undefined });
    await handleLead(post(validBody()), deps);
    expect(store.rows[0]?.emailStatus).toBe('disabled');
  });

  it('refuse sans consentement ou avec des champs invalides, en renvoyant les erreurs par champ', async () => {
    const { deps, store } = setup();
    const res = await handleLead(post(validBody({ consent: false, contact: { ...CONTACT, email: 'x' } })), deps);
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toEqual({ email: 'lead_error_email', consent: 'lead_error_consent' });
    expect(store.rows).toHaveLength(0);
  });

  it('ignore silencieusement les robots (champ piège ou envoi trop rapide)', async () => {
    const { deps, store, sent } = setup();
    expect((await handleLead(post(validBody({ website: 'spam.example' })), deps)).status).toBe(200);
    expect((await handleLead(post(validBody({ elapsedMs: 300 })), deps)).status).toBe(200);
    expect(store.rows).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('limite les envois répétés pour une même adresse', async () => {
    const { deps } = setup();
    for (let i = 0; i < content.settings.lead.maxPerEmailPerHour; i++) {
      expect((await handleLead(post(validBody()), deps)).status).toBe(200);
    }
    expect((await handleLead(post(validBody()), deps)).status).toBe(429);
  });

  it('refuse une autre origine, un JSON invalide, un corps trop gros ou des réponses absentes', async () => {
    const { deps } = setup();
    expect((await handleLead(post(validBody(), 'https://evil.example'), deps)).status).toBe(403);
    expect((await handleLead(post('{oops'), deps)).status).toBe(400);
    expect((await handleLead(post(validBody({ padding: 'x'.repeat(30_000) })), deps)).status).toBe(413);
    expect((await handleLead(post(validBody({ answers: { outils: ['odoo'] } })), deps)).status).toBe(400);
  });

  it('ne fait pas confiance aux réponses : options inconnues écartées', async () => {
    const { deps, store } = setup();
    await handleLead(post(validBody({ answers: { ...profile('negoce-12.yaml').answers, priorite: 'pirate' } })), deps);
    expect(JSON.parse(store.rows[0]!.answersJson).priorite).toBeUndefined();
  });
});

describe('notification et adaptateurs', () => {
  it('l’e-mail échappe le HTML saisi par le visiteur', async () => {
    const { deps, sent } = setup();
    await handleLead(post(validBody({ contact: { ...CONTACT, company: '<img src=x onerror=alert(1)>' } })), deps);
    expect(sent[0]?.html).not.toContain('<img');
    expect(sent[0]?.html).toContain('&lt;img');
  });

  it('les réponses en clair suivent le parcours visible', () => {
    const qa = readableAnswers(content, profile('ecommerce-6.yaml').answers);
    expect(qa[0]).toEqual({
      question: 'Quels logiciels utilisez-vous pour gérer votre activité ?',
      answer: 'Yuki, Shopify, Comptabilité tenue par la fiduciaire',
    });
  });

  it('Brevo : envoie la bonne requête et lève une erreur si l’API refuse', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{}', { status: calls.length === 1 ? 201 : 401 });
    }) as unknown as typeof fetch;
    const send = brevoSender(
      { apiKey: 'k', senderEmail: 's@lophius.be', senderName: 'D', notifyEmail: 'a@lophius.be' },
      fakeFetch,
    );
    const msg: EmailMessage = { subject: 'S', html: '<p>h</p>', text: 't', replyTo: { email: 'r@x.be', name: 'R' } };
    await send(msg);
    expect(calls[0]?.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((calls[0]?.init.headers as Record<string, string>)['api-key']).toBe('k');
    expect(JSON.parse(String(calls[0]?.init.body)).to).toEqual([{ email: 'a@lophius.be' }]);
    await expect(send(msg)).rejects.toThrow('Brevo 401');
  });

  it('D1 : requêtes paramétrées (pas de concaténation de valeurs dans le SQL)', async () => {
    const statements: { sql: string; values: unknown[] }[] = [];
    const db: D1Like = {
      prepare: (sql) => ({
        bind: (...values) => {
          statements.push({ sql, values });
          return { run: async () => ({}), first: async <T>() => ({ n: 2 }) as T };
        },
      }),
    };
    const store = d1Store(db);
    expect(await store.countRecent("x' OR 1=1 --", '2026')).toBe(2);
    expect(statements[0]?.sql).not.toContain("x'");
    expect(statements[0]?.values[0]).toBe("x' OR 1=1 --");
  });
});
