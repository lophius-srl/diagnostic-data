# Proposition de démarrage — Diagnostic Data PME

> Statut : **validé le 2026-11-16** (Cloudflare Pages + sous-domaine, valeurs par défaut ci-dessous).
> Écarts depuis la proposition : schéma Zod dans `src/content/schema.ts` ; plafonds de niveau (`blockedBy`) ;
> Montserrat auto-hébergée (`@fontsource`) plutôt que Google Fonts, pour le RGPD.

---

## (a) Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Front | **Vite + TypeScript + Preact** (SPA, routes en hash) | ~10 ko de runtime, Lighthouse ≥ 90 facile sur mobile, composants testables |
| Contenu | **YAML** dans `content/fr/`, validé par **Zod** au build ; un **JSON Schema** est généré pour l'autocomplétion dans VS Code | Éditable sans toucher au code. Un fichier invalide fait échouer le build avec un message clair |
| Moteur | TypeScript pur (`src/engine/`), sans dépendance au DOM, déterministe | Testable à 100 %, réutilisable côté serveur (fonction de lead) et pour le PDF |
| Graphiques | **SVG écrit à la main** (radar, schémas d'architecture, barres) | Aucune librairie à charger, rendu net sur mobile, réutilisable tel quel dans le PDF |
| PDF | **pdfmake**, chargé à la demande (au clic seulement), Montserrat embarquée | Accepte le SVG nativement. Génération dans le navigateur, aucune donnée envoyée à un tiers |
| Hébergement | **Cloudflare Pages** (gratuit), sous-domaine `diagnostic.lophius.be` | Bande passante illimitée, HTTPS, preview par PR sans GitHub Actions supplémentaire |
| Leads | **Cloudflare Pages Function** `/api/lead` → **D1** (SQLite, localisation `weur`, Europe de l'Ouest) + e-mail via **Brevo** (France, UE, 300 e-mails/jour gratuits) | Un seul fournisseur pour l'hébergement et le stockage. Brevo est européen. Pas de Supabase : un projet gratuit **se met en pause après 7 jours sans activité**, ce qui est risqué pour un formulaire peu fréquenté |
| Partage | Réponses encodées dans le **fragment d'URL** (`#r=…`, base64url compact) | Rien n'est stocké. Le fragment n'est jamais envoyé au serveur |
| Statistiques | **Cloudflare Web Analytics** (sans cookies), **désactivé par défaut** | Respecte « pas de cookies de suivi » |
| Tests | **Vitest** (moteur, contenu, règles de crédibilité) + **Playwright** + **axe-core** (parcours, accessibilité) ; Lighthouse en local (`make lighthouse`) | Playwright est déjà la référence. Lighthouse reste en local pour ne pas alourdir la CI |

**Windows sans droits admin** : Node LTS et `make` via **Scoop** (`scoop install nodejs-lts make`, installation dans le profil utilisateur, sans admin). Les cibles du Makefile appellent `npm run …`, donc `npm run test` etc. fonctionne aussi sans `make`. `wrangler` (CLI Cloudflare) est installé en dépendance de dev, en local au projet.

**IA plus tard** : le moteur produit un objet `DiagnosticResult` typé. Une interface `Synthesizer` (implémentation actuelle `RuleBasedSynthesizer`) permettra de brancher un module « synthèse rédigée par IA » sans toucher au reste.

**CI (sobriété)** : on garde `ci.yml` tel quel (`make install lint test build`, un seul job). On supprime `deploy.yml` (Cloudflare Pages déploie lui-même depuis le repo). Pas de Lighthouse ni de Playwright à chaque push : uniquement un smoke test Playwright headless dans `make test`, rapide.

---

## (b) Arborescence

```
content/
  fr/
    settings.yaml          # coût horaire par défaut, semaines/an, URL de RDV, drapeaux (témoignages, chèques, stats)
    dimensions.yaml        # 7 dimensions : libellé simple + libellé technique (PDF) + poids
    levels.yaml            # 5 niveaux, seuils, description
    tools.yaml             # catalogue des outils belges : id, nom, catégorie, logo
    questions.yaml         # questions, options, conditions d'affichage, scores
    feedbacks.yaml         # retours d'expert en direct + condition de déclenchement
    recommendations.yaml   # quick wins : conditions, outils requis, exclusions, effort, impact, texte
    roadmap.yaml           # feuille de route 30/60/90 j (blocs conditionnels)
    architecture.yaml      # règles des schémas « aujourd'hui » / « cible »
    offers.yaml            # forfaits (placeholders)
    benchmarks.yaml        # repères indicatifs (désactivés, champ `source` obligatoire)
    pages.yaml             # accueil, bio, confidentialité, textes d'interface
  en/                      # vide pour l'instant (structure i18n prête)
schemas/                   # schémas Zod + JSON Schema généré
src/
  engine/                  # conditions, parcours, scoring, coût caché, reco, architecture, encodage partage
  ui/                      # composants Preact (questionnaire, résultats, radar, schémas)
  pdf/                     # génération du rapport (chargée à la demande)
  storage/                 # sauvegarde locale robuste (localStorage → mémoire si indisponible)
  styles/tokens.css        # couleurs, typo, rayons Lophius
functions/api/lead.ts      # Pages Function : validation, D1, e-mail Brevo
migrations/                # schéma D1
public/brand/              # logo Lophius (placeholder SVG en attendant le fichier)
tests/
  fixtures/profils/        # négoce 12 p. · services 40 p. · e-commerce 6 p.
  content.rules.test.ts    # ≤ 15 mots, ≤ 4 réponses, mots interdits, cohérence des références
  engine.*.test.ts
  credibility.test.ts      # pas de reco sur outil non coché, pas de Power BI si « éviter Microsoft », etc.
  e2e/                     # Playwright + axe
docs/decisions.md · docs/adr/ · docs/contenu.md (guide d'édition du YAML)
```

---

## (c) Modèle de données de la config

**Conditions** : un mini-langage JSON sûr, sans `eval`, partagé par questions, retours, recos, schémas :

```yaml
showIf: { all: [ { q: taille, in: [t5_19, t20_49, t50p] }, { q: outils, countAtLeast: 2, exclude: [fiduciaire] } ] }
# opérateurs : all / any / not · q + is | in | has (multi) | countAtLeast
```

**Question**

```yaml
- id: recopie
  text: "Vous recopiez des infos d'un logiciel à l'autre ?"
  type: single            # single | multi | tools (cases à cocher avec logos)
  showIf: { q: outils, countAtLeast: 2, exclude: [fiduciaire, nesaispas] }
  options:
    - { id: non,     label: "Non",            scores: { centralisation: 3, automatisation: 3 } }
    - { id: parfois, label: "Parfois",        scores: { centralisation: 1, automatisation: 1 } }
    - { id: souvent, label: "Oui, souvent",   scores: { centralisation: 0, automatisation: 0 }, facts: [double_saisie] }
```

- `scores` : 0 à 3 points par dimension. Score d'une dimension = points obtenus / maximum possible **sur les questions vues** × 100. Score global = moyenne pondérée (`dimensions.yaml`).
- `facts` : étiquettes métier (`double_saisie`, `dependance_personne`, `pas_de_sauvegarde`…) utilisées par les recos et les schémas.
- `textVariants` : texte alternatif selon une condition (ex. la question rentabilité selon le secteur).

**Retour d'expert** : `{ id, after: <question>, when: <condition>, text, priority }`. Le moteur en affiche au maximum un toutes les 3 questions (`settings.feedbackMinGap: 3`), le plus prioritaire.

**Recommandation (quick win)**

```yaml
- id: qw_unifier_compta_crm
  title: "Connecter {compta} et {crm} dans une base unique"
  detail: "Pour supprimer la double saisie du chiffre d'affaires…"
  when: { q: recopie, in: [parfois, souvent] }
  requiresTools: { compta: [winbooks, bob, exact, yuki, sage], crm: [teamleader, odoo] }   # placeholders remplis avec SES outils
  excludeIf: { q: microsoft, is: eviter }
  dimension: centralisation
  effort: faible | moyen | eleve
  impact: faible | moyen | eleve
  boostIf: { q: priorite, is: doubles_encodages }
```

Tri des recos : impact × écart de la dimension (100 − score) + bonus de priorité, puis 3 premières, sans doublon de dimension si possible.

**Coût caché** : `heures` (milieu de tranche : 1 / 3,5 / 7,5 / 12 h, borne prudente pour « plus de 10 h ») × `semainesParAn` (46) × `coutHoraire` (défaut **45 € / h**, à valider). Affiché « environ X € par an », hypothèses visibles, coût horaire modifiable uniquement sur la page de résultats.

**Repère indicatif** : `{ id, text, value, source: null, enabled: false }`. Le schéma interdit `enabled: true` sans `source` renseignée.

**Forfaits, chèques, témoignages** : `offers.yaml` (titre, durée, prix HTVA, `when` pour la recommandation) ; `settings.cheques.enabled: false` + texte prudent ; `settings.testimonials.enabled: false` + liste vide.

**Lead (D1)** : `id, created_at, prenom, nom, email, entreprise, bce?, telephone?, consent_at, consent_text_version, answers_json, score_global, scores_json, niveau, cout_cache, app_version`.

---

## (d) Questions et branches

**18 questions au total**. Chaque PME en voit **12 à 15** (vérifié par un test exhaustif sur toutes les combinaisons de profil). Toutes font **10 mots au plus**, sans terme de la liste interdite.

| # | id | Question | Réponses | Affichée si | Dimensions |
|---|---|---|---|---|---|
| 1 | secteur | Votre activité, c'est plutôt… | Commerce ou négoce · Services · Production, artisanat, construction · Vente en ligne | toujours | profil |
| 2 | taille | Combien de personnes travaillent dans l'entreprise ? | 1 à 4 · 5 à 19 · 20 à 49 · 50 ou plus | toujours | profil |
| 3 | outils | Où sont vos chiffres ? Cochez tout ce que vous utilisez. | *cases à logos* : Excel / Google Sheets, Odoo, Teamleader, Exact Online, WinBooks, BOB, Yuki, Billit, Sage, Shopify, WooCommerce, Lightspeed, Logiciel métier, **Chez notre fiduciaire**, Je ne sais pas | toujours | Sources |
| 4 | recopie | Vous recopiez des infos d'un logiciel à l'autre ? | Non · Parfois · Oui, souvent | ≥ 2 logiciels cochés | Centralisation, Automatisation |
| 5 | fiduciaire | Votre fiduciaire reçoit vos factures et pièces comment ? | Directement dans son logiciel · Par e-mail ou en PDF · En papier, dans une farde | fiduciaire cochée **et** < 20 pers. | Automatisation, Sources |
| 6a | ventes_en_ligne | Vos ventes en ligne arrivent-elles toutes seules dans la comptabilité ? | Oui, automatiquement · On les exporte à la main · La fiduciaire s'en charge · Je ne sais pas | Shopify / WooCommerce / Lightspeed coché | Centralisation, Automatisation |
| 6b | rentabilite | *(selon le secteur)* Savez-vous quels clients ou projets / produits ou clients vous rapportent vraiment ? · … ce que vous rapporte vraiment chaque chantier ou commande ? | Oui, précisément · À peu près · Pas vraiment | si 6a n'est pas affichée | Pilotage |
| 7 | ventes_mois | Pour connaître vos ventes du mois dernier, il vous faut… | Quelques minutes · Quelques heures · Plusieurs jours | toujours | Pilotage, Centralisation, Autonomie |
| 8 | frequence | Vous regardez vos chiffres… | Chaque semaine · Chaque mois · Surtout au bilan · Rarement | toujours | Pilotage |
| 9 | justesse | Vos chiffres sont-ils toujours justes ? | Oui, on a confiance · Pas toujours · Souvent, on en discute | toujours | Fiabilité |
| 10 | memes_chiffres | En réunion, tout le monde a-t-il les mêmes chiffres ? | Oui · Pas toujours · Chacun a les siens | ≥ 5 pers. | Fiabilité, Centralisation |
| 11 | heures_excel | Combien d'heures par semaine, toute l'équipe, sur des tableaux Excel ? | Moins de 2 h · 2 à 5 h · 5 à 10 h · Plus de 10 h | toujours | Automatisation + **coût caché** |
| 12a | personne_excel | Si votre « personne Excel » est absente un mois… | Pas de souci · Ce serait compliqué · On serait perdus | Excel coché | Autonomie, Sécurité |
| 12b | autonomie | Une question sur vos chiffres : vous trouvez la réponse seul ? | Oui, en quelques clics · Il faut demander · Souvent, on ne trouve pas | si 12a n'est pas affichée | Autonomie |
| 13 | ordinateur | Un ordinateur volé demain : vous perdez des fichiers importants ? | Non, tout est sauvegardé · Peut-être quelques-uns · Oui, sûrement | toujours | Sécurité |
| 14 | acces | Qui peut ouvrir le fichier des salaires ou des marges ? | Seulement les personnes prévues · Je ne suis pas sûr · Un peu tout le monde | ≥ 20 pers. | Sécurité |
| 15 | microsoft | Vous travaillez avec Microsoft 365 (Outlook, Teams) ? | Oui · Non, plutôt Google · Non, et on préfère éviter Microsoft | toujours | préférence (outil de tableau de bord ciblé) |
| 16 | priorite | Si vous pouviez régler une seule chose demain ? | Voir mes chiffres d'un coup d'œil · Arrêter les doubles encodages · Savoir où je gagne de l'argent · Ne plus dépendre d'une seule personne | toujours | ordre des recos et forfait mis en avant |

Le sélecteur d'outils (n° 3) est la **seule exception** à la règle des 4 réponses, comme le demande le brief. Le test l'autorise pour le type `tools` uniquement.

**Parcours des 3 profils de test**

| Profil | Questions vues | Résultat attendu (à confirmer par les tests) |
|---|---|---|
| Négoce, 12 p., Excel + WinBooks + fiduciaire | 15 (1-5, 6b, 7-11, 12a, 13, 15, 16) | Niveau « Structuré ». Quick wins : pièces vers la fiduciaire, base centrale ventes/stock, réduire la dépendance à la « personne Excel ». Cible : WinBooks + Excel → base centrale → tableau de bord. |
| Services, 40 p., Odoo + Excel | 15 (1-4, 6b, 7-11, 12a, 13, 14, 15, 16) | Niveau « Piloté ». Quick wins : rentabilité par projet depuis Odoo, une seule version des chiffres, droits d'accès. Cible : Odoo → entrepôt → Power BI ou Looker Studio selon la question 15. |
| E-commerce, 6 p., Shopify + Yuki + fiduciaire | 15 (1-5, 6a, 7-11, 12b, 13, 15, 16) | Niveau « Structuré » ou « Piloté ». Quick wins : Shopify → Yuki automatique, marge par produit, tableau de bord hebdo. |

**Retours d'expert prévus** (un sur 3-4 questions au maximum, ton bienveillant, 2 phrases) :
- recopie = souvent : « Vous n'êtes pas seul : c'est le cas typique d'une PME qui a grandi plus vite que ses outils. C'est aussi ce qui se corrige le plus vite. »
- fiduciaire = papier : « Depuis 2026, la facture électronique entre entreprises est obligatoire en Belgique. C'est le bon moment pour envoyer vos pièces directement à votre fiduciaire. » *(fait réglementaire, à vérifier par toi)*
- justesse = souvent on en discute : « Quand on discute des chiffres plutôt que des décisions, il existe souvent plusieurs versions du même fichier. »
- personne_excel = on serait perdus : « C'est très courant, et c'est un vrai risque pour l'entreprise. Ce savoir se transmet et se documente en quelques jours. »
- ventes_mois = quelques minutes : « Très bon signe : c'est la base de tout pilotage, et vous l'avez déjà. »

**Niveaux** : Artisanal (0-19) → Structuré (20-39) → Piloté (40-59) → Automatisé (60-79) → Data-driven (80-100).

**Schémas** : « Aujourd'hui » = les outils cochés, regroupés par rôle (compta, ventes, e-commerce, tableur, fiduciaire), avec flèches pointillées « copie manuelle » quand recopie ≠ non, et silos marqués. « Cible » = ses outils → intégration automatique → base centrale → tableau de bord (Power BI / Looker Studio / Metabase selon la question 15), avec la fiduciaire branchée si cochée.

---

## (e) Découpage en issues (14, créées une par une après ta validation, ≥ 30 s d'écart)

| # | Étape | Issue | Taille |
|---|---|---|---|
| 1 | 0 | chore: kickoff (stack, Makefile, CLAUDE.md, ADR 0002, tokens CSS, suppression de deploy.yml) | S |
| 2 | 1 | feat: schémas Zod + chargement du contenu YAML + JSON Schema | M |
| 3 | 1 | feat: moteur de conditions + parcours adaptatif + tests 12-15 questions | M |
| 4 | 1 | feat: contenu v1 (questions, retours) + test des règles de rédaction | M |
| 5 | 1 | feat: scoring, niveaux, coût caché + fixtures des 3 profils | M |
| 6 | 1 | feat: UI du questionnaire (boutons, progression, sauvegarde locale, retours en direct) | M |
| 7 | 2 | feat: résultats (score, radar, coût caché animé + coût horaire modifiable) | M |
| 8 | 2 | feat: quick wins + feuille de route + forfaits, avec tests de crédibilité | M |
| 9 | 3 | feat: schémas d'architecture SVG « aujourd'hui / cible » | L → découpée si > 400 lignes |
| 10 | 4 | feat: formulaire de lead + consentement + Pages Function + D1 + e-mail Brevo | M |
| 11 | 4 | feat: lien de partage (fragment d'URL) + bouton de prise de RDV | S |
| 12 | 5 | feat: rapport PDF (pdfmake, chargé à la demande) | L |
| 13 | 6 | feat: page d'accueil + politique de confidentialité + blocs masqués (témoignages, chèques) | M |
| 14 | 6 | chore: animations (prefers-reduced-motion), audit d'accessibilité et Lighthouse | S |

---

## À valider

1. **Stack** : Preact + Cloudflare Pages + D1 + Brevo. Tu devras créer un compte Cloudflare et un compte Brevo (gratuits) ; je prépare la config et `.env.example`.
2. **Coût horaire par défaut** : 45 € / h chargé, et 46 semaines par an ?
3. **Forfaits** : noms, durées et prix HTVA. Sinon je mets des placeholders.
4. **URL de prise de RDV** et **sous-domaine** (`diagnostic.lophius.be` ?).
5. **Logo et bio** : le conteneur n'a pas accès à lophius.be (réseau bloqué). Dépose le logo dans `public/brand/`, ou autorise l'hôte `www.lophius.be`. En attendant, je mets un placeholder et une bio reprise du brief.
6. **Branches** : `CLAUDE.md` impose une branche par issue (`feat/<n°>-…`). Cette session cloud est configurée pour pousser sur `claude/new-session-kjxci2`. Je propose de travailler sur cette branche avec un commit par issue, et un push par étape. Ou préfères-tu que je crée les branches `feat/…` ?
7. **Questions** : la liste ci-dessus te convient-elle (formulations, seuils de taille, exception du sélecteur d'outils) ?
