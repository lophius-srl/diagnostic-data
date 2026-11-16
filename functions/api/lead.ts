import contentJson from '../../src/generated/content.fr.json';
import type { Content } from '../../src/content/schema';
import { brevoSender } from '../../src/server/brevo';
import { d1Store } from '../../src/server/d1-store';
import { handleLead } from '../../src/server/lead-handler';

/**
 * POST /api/lead — Cloudflare Pages Function.
 * Variables (Cloudflare → Pages → Settings → Variables and secrets ; en local : .dev.vars) :
 *   BREVO_API_KEY (secret), LEAD_NOTIFY_EMAIL, LEAD_SENDER_EMAIL, LEAD_SENDER_NAME, ALLOWED_ORIGIN.
 * Base D1 liée sous le nom DB (wrangler.toml).
 */
interface Env {
  DB: D1Database;
  BREVO_API_KEY?: string;
  LEAD_NOTIFY_EMAIL?: string;
  LEAD_SENDER_EMAIL?: string;
  LEAD_SENDER_NAME?: string;
  ALLOWED_ORIGIN?: string;
}

const content = contentJson as unknown as Content;

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => {
  const emailReady = env.BREVO_API_KEY && env.LEAD_NOTIFY_EMAIL && env.LEAD_SENDER_EMAIL;
  return handleLead(request, {
    content,
    store: d1Store(env.DB),
    ...(emailReady && {
      sendEmail: brevoSender({
        apiKey: env.BREVO_API_KEY!,
        notifyEmail: env.LEAD_NOTIFY_EMAIL!,
        senderEmail: env.LEAD_SENDER_EMAIL!,
        senderName: env.LEAD_SENDER_NAME ?? 'Diagnostic Lophius',
      }),
    }),
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    ...(env.ALLOWED_ORIGIN && { allowedOrigin: env.ALLOWED_ORIGIN }),
    logError: (message) => console.error(message),
  });
};
