import type { EmailMessage } from './lead-email';

export interface BrevoConfig {
  apiKey: string;
  /** Expéditeur validé dans Brevo (ex. diagnostic@lophius.be). */
  senderEmail: string;
  senderName: string;
  /** Destinataire des notifications (Antoine). */
  notifyEmail: string;
}

/** Envoi transactionnel via l'API Brevo (hébergée dans l'UE). Lève une erreur si l'envoi échoue. */
export function brevoSender(cfg: BrevoConfig, fetchImpl: typeof fetch = fetch) {
  return async (message: EmailMessage): Promise<void> => {
    const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': cfg.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: cfg.senderEmail, name: cfg.senderName },
        to: [{ email: cfg.notifyEmail }],
        replyTo: message.replyTo,
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });
    if (!response.ok) throw new Error(`Brevo ${response.status}`);
  };
}
