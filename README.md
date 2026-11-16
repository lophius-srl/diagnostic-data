# Diagnostic Data PME — Lophius

Diagnostic de maturité data en ligne pour PME wallonnes : 12 à 15 questions simples, un score sur 7 axes,
le coût caché du reporting manuel, et (étapes suivantes) des recommandations, des schémas d'architecture et un rapport PDF.

## Installation (Windows, sans droits admin)

1. Installer [Scoop](https://scoop.sh) dans PowerShell (aucun droit admin requis) :
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   irm get.scoop.sh | iex
   ```
2. Installer Node et make :
   ```powershell
   scoop install nodejs-lts make
   ```
3. Dans le dossier du projet :
   ```powershell
   make install
   make dev
   ```
   Sans `make`, les mêmes commandes existent en `npm` : `npm ci`, `npm run dev`, `npm test`, `npm run build`.

L'app tourne sur http://localhost:5173.

## Commandes

| Action | Commande |
|---|---|
| Lancer en local | `make dev` |
| Vérifier le contenu YAML | `make content` |
| Lint / format | `make lint` / `make format` |
| Tests | `make test` |
| Build | `make build` puis `make preview` |
| App + fonction des leads + base locale | `make dev-full` (http://localhost:8788) |
| Export des leads en CSV | `make leads-export` |

## Modifier le diagnostic sans toucher au code

Tout le contenu est dans `content/fr/` :

| Fichier | Contenu |
|---|---|
| `questions.yaml` | questions, réponses, points par axe, conditions d'affichage |
| `feedbacks.yaml` | retours d'expert en direct |
| `dimensions.yaml` | les 7 axes du radar |
| `levels.yaml` | les 5 niveaux et leurs plafonds |
| `tools.yaml` | catalogue des logiciels (logos dans `public/brand/tools/`) |
| `settings.yaml` | coût horaire par défaut, liens, options (témoignages, chèques-entreprises, statistiques) |
| `benchmarks.yaml` | repères indicatifs (désactivés tant qu'aucune source n'est renseignée) |
| `ui.yaml` | textes d'interface |

Après une modification, `make content` valide tout et explique les erreurs en clair.
`make test` vérifie aussi les règles de rédaction (15 mots, 4 réponses, pas de jargon) et les parcours (12 à 15 questions).

## Mise en ligne
Cloudflare Pages + D1 + Brevo, tout gratuit : voir `docs/deploiement.md`.

## Documentation
- `docs/decisions.md` : la stack en 5 lignes ; `docs/adr/` : décisions d'architecture.
- `docs/proposition-kickoff.md` : questions, branches, modèle de configuration, découpage en issues.
- `GUIDE.md` : mise en place du kit de développement (GitHub, agents, CI).
