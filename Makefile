# Point d'entrée unique pour toutes les commandes du projet (la CI lance `make install lint test build`).
# Sous Windows sans droits admin : `scoop install nodejs-lts make`, ou lancer directement les `npm run …` ci-dessous.

.PHONY: install dev dev-full lint format test build preview content leads-export db-migrate

install:
	npm ci

dev:
	npm run content
	npm run dev

lint:
	npm run content
	npm run lint

format:
	npm run format

test:
	npm test

build:
	npm run build

preview:
	npm run preview

# Valide le contenu YAML (content/) sans lancer l'app.
content:
	npm run content

# App + fonction /api/lead + base D1 locale (http://localhost:8788). Copier .dev.vars.example en .dev.vars.
dev-full:
	npm run dev:full

# Applique les migrations sur la base D1 en ligne (après « wrangler login »).
db-migrate:
	npm run db:migrate

# Exporte les leads en CSV dans exports/ (ajouter LOCAL=1 pour la base locale).
leads-export:
	npm run leads:export -- $(if $(LOCAL),--local,)
