# Point d'entrée unique pour toutes les commandes du projet (la CI lance `make install lint test build`).
# Sous Windows sans droits admin : `scoop install nodejs-lts make`, ou lancer directement les `npm run …` ci-dessous.

.PHONY: install dev lint format test build preview content

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
