# Mise en ligne — Cloudflare Pages, D1 et Brevo (tout gratuit)

Compte environ 30 minutes la première fois. Aucune étape ne demande de droits admin sur ton PC.

## 1. Cloudflare Pages (le site)

1. Crée un compte gratuit sur https://dash.cloudflare.com.
2. *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → choisis `lophius-srl/diagnostic-data`.
3. Réglages de build :
   - **Framework preset** : None
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
   - Variable d'environnement de build : `NODE_VERSION` = `22`
4. Branche de production : `main`. Chaque PR aura une URL de preview, sans minute GitHub Actions.

## 2. Base D1 (les leads, en Europe de l'Ouest)

Dans PowerShell, à la racine du projet :

```powershell
npx wrangler login
npx wrangler d1 create diagnostic-leads --location weur
```

Copie l'identifiant affiché (`database_id`) dans `wrangler.toml`, puis crée la table :

```powershell
make db-migrate
```

Dans Cloudflare : projet Pages → *Settings* → *Bindings* → *Add* → *D1 database* : nom `DB`, base `diagnostic-leads`.

## 3. Brevo (la notification par e-mail)

1. Crée un compte gratuit sur https://www.brevo.com (300 e-mails par jour).
2. *Senders, domains* : ajoute et vérifie l'expéditeur, par exemple `diagnostic@lophius.be`
   (idéalement en authentifiant le domaine lophius.be : enregistrements DNS fournis par Brevo).
3. *SMTP & API* → *API keys* → crée une clé.
4. Dans Cloudflare : projet Pages → *Settings* → *Variables and secrets* (environnement *Production*) :

| Nom | Où | Valeur |
|---|---|---|
| `BREVO_API_KEY` | tableau de bord Cloudflare, type **Secret** (Production et Preview) | la clé Brevo |
| `LEAD_NOTIFY_EMAIL`, `LEAD_SENDER_EMAIL`, `LEAD_SENDER_NAME` | **`wrangler.toml`**, section `[vars]` | adresses et nom (déjà renseignés) |
| `ALLOWED_ORIGIN` | **`wrangler.toml`**, section `[vars]` | `https://diagnostic.lophius.be`, une fois le sous-domaine branché |

Important : comme le projet contient un `wrangler.toml`, Cloudflare ignore les variables **non secrètes** saisies
dans le tableau de bord. Seuls les secrets s'y gèrent.

Sans ces variables, les leads sont quand même enregistrés dans D1 (statut `disabled`).
Si Brevo échoue, le lead est conservé avec le statut `failed`.

## 4. Sous-domaine diagnostic.lophius.be

Projet Pages → *Custom domains* → *Set up a domain* → `diagnostic.lophius.be`.
Cloudflare indique un enregistrement **CNAME** à ajouter là où le DNS de lophius.be est géré
(chez Vercel si le domaine y est) : `diagnostic` → `<projet>.pages.dev`. Le site lophius.be reste sur Vercel.

Pour servir plutôt le diagnostic sous `lophius.be/diagnostic`, voir `VITE_BASE_PATH` dans `vite.config.ts`
et une règle de *rewrite* dans le `vercel.json` du site.

## 5. Consulter les leads

- Chaque lead arrive par e-mail, avec les coordonnées, le score, le coût caché, les quick wins,
  toutes les réponses en clair et un lien vers le diagnostic complet.
- Export CSV (ouvrable dans Excel) : `make leads-export` → fichier dans `exports/` (jamais commité).
- Dans le tableau de bord Cloudflare : *D1* → `diagnostic-leads` → *Console*.

## 6. Tester en local avant de pousser

```powershell
Copy-Item .dev.vars.example .dev.vars   # puis remplis les valeurs si tu veux tester l'e-mail
make dev-full                            # http://localhost:8788, base D1 locale
LOCAL=1 make leads-export                # (dans Git Bash) ou : npm run leads:export -- --local
```

## RGPD : à faire avant la mise en ligne

- Compléter `content/fr/privacy.yaml` (adresse, BCE, durée de conservation, contact).
- Accepter les conditions de traitement des données (DPA) de Cloudflare et de Brevo dans leurs tableaux de bord.
- Si le texte de consentement (`lead_consent` dans `ui.yaml`) change : incrémenter `lead.consentVersion` dans `settings.yaml`.

## 7. Statistiques de visite (facultatif, sans cookie)

Désactivées par défaut. Pour les activer avec Cloudflare Web Analytics :
1. Cloudflare → *Analytics & Logs* → *Web Analytics* → ajoute le site, copie le jeton.
2. `content/fr/settings.yaml` : `analyticsToken: "<jeton>"` et `features.analytics: true`.
3. `public/_headers` : ajoute `https://static.cloudflareinsights.com` à `script-src`
   et `https://cloudflareinsights.com` à `connect-src`.
4. N'active **pas** l'injection automatique proposée par Cloudflare Pages : la politique de sécurité la bloquerait.

## 8. Avant la mise en ligne : tout ce qui reste à remplir

| Où | Quoi |
|---|---|
| `public/brand/` | logo et photo repris de lophius.be (à remplacer si tu en changes) |
| `content/fr/home.yaml` | relire la bio |
| `content/fr/settings.yaml` | `links.booking` (agenda), `links.contact`, `defaultHourlyRate` (45 € par défaut) |
| `content/fr/offers.yaml` | durées et prix HTVA des 3 forfaits |
| `content/fr/privacy.yaml` | adresse, BCE, durée de conservation, contact |
| `content/fr/benchmarks.yaml` | repères indicatifs : n'activer qu'avec une source |
| `home.yaml` (`testimonials`) + `features.testimonials` | uniquement de vrais témoignages, avec accord écrit |
| `features.chequesEntreprises` | à activer quand la labellisation et l'éligibilité sont confirmées |
| `wrangler.toml` | `database_id` de la base D1 |
| Cloudflare / Brevo | variables et secret (section 3), DPA acceptés |
