import type { LeadRecord, LeadStore } from './lead-handler';

/** Sous-ensemble de l'API D1 utilisé ici (évite de dépendre des types Workers dans src/). */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): { run(): Promise<unknown>; first<T = Record<string, unknown>>(): Promise<T | null> };
  };
}

export function d1Store(db: D1Like): LeadStore {
  return {
    async countRecent(email, sinceIso) {
      const row = await db
        .prepare('SELECT COUNT(*) AS n FROM leads WHERE email = ?1 AND created_at >= ?2')
        .bind(email, sinceIso)
        .first<{ n: number }>();
      return row?.n ?? 0;
    },
    async insert(r: LeadRecord) {
      await db
        .prepare(
          `INSERT INTO leads (id, created_at, first_name, last_name, email, company, bce, phone,
             consent_at, consent_version, answers_json, score_global, level, scores_json, hidden_cost,
             content_version, share_url, email_status)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`,
        )
        .bind(
          r.id,
          r.createdAt,
          r.contact.firstName,
          r.contact.lastName,
          r.contact.email,
          r.contact.company,
          r.contact.bce || null,
          r.contact.phone || null,
          r.consentAt,
          r.consentVersion,
          r.answersJson,
          r.scoreGlobal,
          r.level,
          r.scoresJson,
          r.hiddenCost,
          r.contentVersion,
          r.shareUrl,
          r.emailStatus,
        )
        .run();
    },
    async updateEmailStatus(id, status) {
      await db.prepare('UPDATE leads SET email_status = ?1 WHERE id = ?2').bind(status, id).run();
    },
  };
}
