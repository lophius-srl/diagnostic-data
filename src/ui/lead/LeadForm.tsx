import { useMemo, useRef, useState } from 'preact/hooks';
import { content, t } from '../../content';
import type { Answers } from '../../engine/conditions';
import { EMPTY_CONTACT, validateLead, type LeadContact, type LeadErrors, type LeadField } from '../../lead/validate';

interface Props {
  answers: Answers;
  hourlyRate: number | undefined;
  onSuccess: (firstName: string, company: string) => void;
}

type Status = 'idle' | 'sending' | 'network' | 'rate';

/** Même présentation que le formulaire de contact de lophius.be : astérisque sur les champs obligatoires, exemple dans le champ. */
const FIELDS: { name: keyof LeadContact; type: string; autocomplete: string; optional?: boolean }[] = [
  { name: 'firstName', type: 'text', autocomplete: 'given-name' },
  { name: 'lastName', type: 'text', autocomplete: 'family-name' },
  { name: 'email', type: 'email', autocomplete: 'email' },
  { name: 'company', type: 'text', autocomplete: 'organization' },
  { name: 'bce', type: 'text', autocomplete: 'off', optional: true },
  { name: 'phone', type: 'tel', autocomplete: 'tel', optional: true },
];

const LABEL_KEY: Record<keyof LeadContact, string> = {
  firstName: 'lead_first_name',
  lastName: 'lead_last_name',
  email: 'lead_email',
  company: 'lead_company',
  bce: 'lead_bce',
  phone: 'lead_phone',
};

/** Formulaire de capture : validation identique au serveur, champ piège invisible, aucun cookie. */
export function LeadForm({ answers, hourlyRate, onSuccess }: Props) {
  const startedAt = useMemo(() => Date.now(), []);
  const [contact, setContact] = useState<LeadContact>(EMPTY_CONTACT);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const honeypot = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  const showErrors = (next: LeadErrors) => {
    setErrors(next);
    const first = Object.keys(next)[0] as LeadField | undefined;
    if (first) document.getElementById(`lead-${first}`)?.focus();
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    const local = validateLead(contact, consent);
    if (Object.keys(local).length > 0) return showErrors(local);
    setStatus('sending');
    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contact,
          consent,
          consentVersion: content.settings.lead.consentVersion,
          answers,
          hourlyRate,
          website: honeypot.current?.value ?? '',
          elapsedMs: Date.now() - startedAt,
        }),
      });
      if (response.status === 429) return setStatus('rate');
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; errors?: LeadErrors };
      if (response.ok && body.ok) return onSuccess(contact.firstName.trim(), contact.company.trim());
      if (body.errors) {
        setStatus('idle');
        return showErrors(body.errors);
      }
      setStatus('network');
    } catch {
      setStatus('network');
    }
    summaryRef.current?.focus();
  };

  const hasErrors = Object.keys(errors).length > 0;
  const errorId = (f: LeadField) => `lead-${f}-error`;

  return (
    <form class="lead-form" onSubmit={submit} noValidate>
      {(hasErrors || status === 'network' || status === 'rate') && (
        <p class="form-alert" role="alert" tabIndex={-1} ref={summaryRef}>
          {status === 'network'
            ? t('lead_error_network')
            : status === 'rate'
              ? t('lead_error_rate')
              : t('lead_error_summary')}
        </p>
      )}
      <div class="form-grid">
        {FIELDS.map((f) => {
          const error = errors[f.name];
          const describedBy = error ? errorId(f.name) : '';
          return (
            <div class="field" key={f.name}>
              <label for={`lead-${f.name}`}>
                {t(LABEL_KEY[f.name])}
                {!f.optional && (
                  <span class="required" aria-hidden="true">
                    {' '}
                    *
                  </span>
                )}
              </label>
              <input
                id={`lead-${f.name}`}
                name={f.name}
                type={f.type}
                autoComplete={f.autocomplete}
                inputMode={f.name === 'bce' ? 'numeric' : undefined}
                required={!f.optional}
                aria-required={!f.optional}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy || undefined}
                placeholder={t(`${LABEL_KEY[f.name]}_placeholder`)}
                value={contact[f.name]}
                onInput={(e) => setContact({ ...contact, [f.name]: (e.currentTarget as HTMLInputElement).value })}
              />
              {error && (
                <p id={errorId(f.name)} class="field-error">
                  {t(error)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Champ piège pour les robots : invisible et ignoré par les lecteurs d'écran. */}
      <div class="hp" aria-hidden="true">
        <label for="lead-website">Site web</label>
        <input id="lead-website" name="website" type="text" tabIndex={-1} autoComplete="off" ref={honeypot} />
      </div>

      <div class="field consent">
        <label class="consent-label">
          <input
            id="lead-consent"
            type="checkbox"
            checked={consent}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? errorId('consent') : undefined}
            onChange={(e) => setConsent((e.currentTarget as HTMLInputElement).checked)}
          />
          <span>
            {t('lead_consent')}{' '}
            <a href="#/confidentialite" target="_blank" rel="noopener">
              {t('lead_privacy_link')}
            </a>
          </span>
        </label>
        {errors.consent && (
          <p id={errorId('consent')} class="field-error">
            {t(errors.consent)}
          </p>
        )}
      </div>

      <div class="form-submit">
        <button type="submit" class="btn btn-cta" disabled={status === 'sending'}>
          {status === 'sending' ? t('lead_sending') : t('lead_submit')}
        </button>
      </div>
    </form>
  );
}
