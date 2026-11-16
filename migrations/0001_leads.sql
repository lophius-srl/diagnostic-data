-- Leads du diagnostic. Données personnelles : durée de conservation définie dans la politique de confidentialité.
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  bce TEXT,
  phone TEXT,
  consent_at TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  score_global INTEGER NOT NULL,
  level TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  hidden_cost INTEGER,
  content_version TEXT NOT NULL,
  share_url TEXT NOT NULL,
  email_status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_email_created ON leads (email, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at);
