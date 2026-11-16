/**
 * Validation des coordonnées, partagée entre le navigateur et la fonction serveur.
 * Les messages d'erreur sont des clés de ui.yaml (le serveur renvoie les clés, l'interface les traduit).
 */
export interface LeadContact {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  bce: string;
  phone: string;
}

export type LeadField = keyof LeadContact | 'consent';
export type LeadErrors = Partial<Record<LeadField, string>>;

export const EMPTY_CONTACT: LeadContact = { firstName: '', lastName: '', email: '', company: '', bce: '', phone: '' };

const MAX = { firstName: 60, lastName: 80, email: 120, company: 120, bce: 20, phone: 30 } as const;

/** E-mail : volontairement simple (le vrai contrôle, c'est la réponse au message). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Supprime les espaces superflus et les caractères de contrôle. */
export function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const printable = Array.from(value, (ch) => {
    const code = ch.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : ch;
  }).join('');
  return printable.replace(/\s+/g, ' ').trim().slice(0, max);
}

export function normalizeContact(input: unknown): LeadContact {
  const o = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  return {
    firstName: clean(o.firstName, MAX.firstName),
    lastName: clean(o.lastName, MAX.lastName),
    email: clean(o.email, MAX.email).toLowerCase(),
    company: clean(o.company, MAX.company),
    bce: clean(o.bce, MAX.bce),
    phone: clean(o.phone, MAX.phone),
  };
}

/**
 * Numéro d'entreprise BCE : 10 chiffres commençant par 0 ou 1 (« 0123.456.749 », « BE 0123456749 »),
 * dont les 2 derniers valent 97 − (les 8 premiers modulo 97).
 */
export function normalizeBce(value: string): string | undefined {
  const digits = value.replace(/^BE/i, '').replace(/[\s.\-/]/g, '');
  const ten = /^\d{9}$/.test(digits) ? `0${digits}` : digits;
  if (!/^[01]\d{9}$/.test(ten)) return undefined;
  const check = 97 - (Number(ten.slice(0, 8)) % 97);
  if (check !== Number(ten.slice(8))) return undefined;
  return `${ten.slice(0, 4)}.${ten.slice(4, 7)}.${ten.slice(7)}`;
}

/** Téléphone : chiffres, espaces, +, points, tirets, parenthèses ; 8 à 15 chiffres. */
export function isValidPhone(value: string): boolean {
  if (!/^[+\d\s().\-/]+$/.test(value)) return false;
  const count = value.replace(/\D/g, '').length;
  return count >= 8 && count <= 15;
}

export function validateLead(contact: LeadContact, consent: boolean): LeadErrors {
  const errors: LeadErrors = {};
  if (!contact.firstName) errors.firstName = 'lead_error_required';
  if (!contact.lastName) errors.lastName = 'lead_error_required';
  if (!contact.company) errors.company = 'lead_error_required';
  if (!contact.email) errors.email = 'lead_error_required';
  else if (!EMAIL.test(contact.email)) errors.email = 'lead_error_email';
  if (contact.bce && !normalizeBce(contact.bce)) errors.bce = 'lead_error_bce';
  if (contact.phone && !isValidPhone(contact.phone)) errors.phone = 'lead_error_phone';
  if (!consent) errors.consent = 'lead_error_consent';
  return errors;
}
