# Décisions — Diagnostic Data PME

> Statut : **proposé**, en attente de validation (détail dans `docs/proposition-kickoff.md`).

1. **Front statique Vite + TypeScript + Preact** : bundle minuscule (Lighthouse ≥ 90 sur mobile), aucun serveur à maintenir, tourne sous Windows sans admin (Node et make via Scoop).
2. **Contenu en YAML validé par Zod au build** : le diagnostic évolue sans toucher au code, et une erreur de contenu casse le build au lieu de casser la page.
3. **Moteur déterministe en TypeScript pur** (règles, aucun LLM) : coût nul, résultat reproductible et testable. Interface `Synthesizer` prête pour une synthèse IA plus tard.
4. **Cloudflare Pages + Pages Function + D1 (Europe de l'Ouest) + Brevo (UE) pour les leads** : tout est gratuit et les données restent en Europe. Pas de Supabase, dont l'offre gratuite se met en pause après 7 jours d'inactivité.
5. **SVG fait main et PDF généré dans le navigateur (pdfmake, chargé à la demande), partage par fragment d'URL** : aucune donnée envoyée à un tiers, aucun cookie, et un rapport fidèle à la marque.
