# 0002 — Stack du diagnostic data

- **Date** : 2026-11-16
- **Statut** : accepté

## Contexte
Outil d'acquisition de clients pour Lophius SRL : un diagnostic en ligne, mobile first, que le gérant d'une PME
remplit en 5 minutes. Contraintes : outils gratuits uniquement, RGPD (données en UE, pas de cookies de suivi),
contenu modifiable sans code, Lighthouse ≥ 90, développement sous Windows sans droits admin.

## Décision
- **Front** : Vite + TypeScript + Preact, SPA statique à routes en hash.
- **Contenu** : YAML dans `content/<langue>/`, validé par Zod et par des contrôles croisés au build (`npm run content`) ;
  JSON Schema généré dans `schemas/` pour l'autocomplétion.
- **Moteur** : règles déterministes en TypeScript pur (`src/engine/`), aucun LLM au runtime.
  Une interface de synthèse permettra d'ajouter un module IA plus tard.
- **Hébergement** : Cloudflare Pages (offre gratuite, usage commercial autorisé), sous-domaine `diagnostic.lophius.be`
  (CNAME depuis le DNS actuel). Le site lophius.be reste sur Vercel.
- **Leads (étape 4)** : Pages Function → D1 (localisation Europe de l'Ouest) + e-mail via Brevo (UE).
- **Typographie** : Montserrat auto-hébergée (`@fontsource/montserrat`), aucun appel à Google Fonts.

## Alternatives écartées
- **Vercel Hobby** : réservé à un usage non commercial ; Pro payant.
- **Supabase gratuit** : le projet se met en pause après 7 jours sans activité.
- **Formspree / Web3Forms** : données traitées hors UE.

## Conséquences
- `deploy.yml` supprimé : Cloudflare Pages déploie depuis le repo, avec une preview par PR, sans minutes Actions.
- La CI reste un seul job court (`make install lint test build`).
