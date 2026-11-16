import type { Content } from '../content/schema';
import { buildDiagnostic } from '../engine/diagnostic';
import { effectiveAnswers } from '../engine/flow';
import { shareUrl } from '../lead/share';
import { normalizeBce, normalizeContact, validateLead, type LeadContact } from '../lead/validate';
import { sanitizeAnswers } from '../storage/progress';
import { leadEmail, type EmailMessage } from './lead-email';

/** Enregistrement stocké en base (D1). */
export interface LeadRecord {
  id: string;
  createdAt: string;
  contact: LeadContact;
  consentAt: string;
  consentVersion: string;
  answersJson: string;
  scoreGlobal: number;
  level: string;
  scoresJson: string;
  hiddenCost: number | null;
  contentVersion: string;
  shareUrl: string;
  emailStatus: 'sent' | 'failed' | 'disabled';
}

export interface LeadStore {
  countRecent(email: string, sinceIso: string): Promise<number>;
  insert(record: LeadRecord): Promise<void>;
  updateEmailStatus(id: string, status: LeadRecord['emailStatus']): Promise<void>;
}

export interface LeadDeps {
  content: Content;
  store: LeadStore;
  /** Absent : notification désactivée (développement local sans clé Brevo). */
  sendEmail?: (message: EmailMessage) => Promise<void>;
  now: () => Date;
  newId: () => string;
  /** Origine autorisée (ex. https://diagnostic.lophius.be) ; absente : pas de contrôle. */
  allowedOrigin?: string;
  logError?: (message: string) => void;
}

const MAX_BODY_BYTES = 20_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

/**
 * Reçoit un lead : contrôle d'origine et de taille, anti-robot, validation, score recalculé côté serveur
 * (on ne fait pas confiance au navigateur), stockage, puis notification. Le lead est conservé même si l'e-mail échoue.
 */
export async function handleLead(request: Request, deps: LeadDeps): Promise<Response> {
  const { content } = deps;
  const origin = request.headers.get('origin');
  if (deps.allowedOrigin && origin !== deps.allowedOrigin) return json(403, { ok: false, error: 'origin' });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'too_large' });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }
  if (typeof body !== 'object' || body === null) return json(400, { ok: false, error: 'invalid_json' });

  // Anti-robot sans cookie : champ piège rempli ou formulaire envoyé trop vite → on fait semblant d'accepter.
  const elapsed = typeof body.elapsedMs === 'number' ? body.elapsedMs : 0;
  if ((typeof body.website === 'string' && body.website !== '') || elapsed < content.settings.lead.minFillMs) {
    return json(200, { ok: true });
  }

  const contact = normalizeContact(body.contact);
  const consent = body.consent === true;
  const errors = validateLead(contact, consent);
  if (Object.keys(errors).length > 0) return json(400, { ok: false, errors });
  if (contact.bce) contact.bce = normalizeBce(contact.bce) ?? contact.bce;

  const answers = effectiveAnswers(content, sanitizeAnswers(content, body.answers));
  if (Object.keys(answers).length < 5) return json(400, { ok: false, error: 'answers' });

  const now = deps.now();
  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
  if ((await deps.store.countRecent(contact.email, hourAgo)) >= content.settings.lead.maxPerEmailPerHour) {
    return json(429, { ok: false, error: 'rate_limited' });
  }

  const rate =
    typeof body.hourlyRate === 'number' && body.hourlyRate > 0 && body.hourlyRate <= 500 ? body.hourlyRate : undefined;
  const result = buildDiagnostic(content, answers, rate === undefined ? {} : { hourlyRate: rate });
  const link = shareUrl(content, answers, true);
  const record: LeadRecord = {
    id: deps.newId(),
    createdAt: now.toISOString(),
    contact,
    consentAt: now.toISOString(),
    consentVersion: typeof body.consentVersion === 'string' ? body.consentVersion.slice(0, 40) : 'inconnue',
    answersJson: JSON.stringify(answers),
    scoreGlobal: result.score.global,
    level: result.score.level.id,
    scoresJson: JSON.stringify(result.score.dimensions),
    hiddenCost: result.hiddenCost?.yearlyCost ?? null,
    contentVersion: content.settings.contentVersion,
    shareUrl: link,
    emailStatus: deps.sendEmail ? 'sent' : 'disabled',
  };
  await deps.store.insert(record);

  if (deps.sendEmail) {
    try {
      await deps.sendEmail(leadEmail(content, contact, answers, result, link));
    } catch (error) {
      deps.logError?.(`notification du lead ${record.id} en échec : ${String(error)}`);
      await deps.store.updateEmailStatus(record.id, 'failed');
    }
  }
  return json(200, { ok: true, id: record.id });
}
