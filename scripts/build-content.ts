import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { loadContent } from '../src/content/load-node';
import { ContentSchema } from '../src/content/schema';

/**
 * Valide le contenu YAML de chaque langue et le compile en JSON pour l'app.
 * Génère aussi schemas/content.schema.json (autocomplétion dans l'éditeur).
 * Échoue avec un message lisible si un fichier est invalide.
 */
const root = process.cwd();
const outDir = join(root, 'src', 'generated');
mkdirSync(outDir, { recursive: true });

const locales = readdirSync(join(root, 'content'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, 'content', d.name, 'settings.yaml')))
  .map((d) => d.name);

for (const locale of locales) {
  const content = loadContent(locale);
  writeFileSync(join(outDir, `content.${locale}.json`), JSON.stringify(content));
  process.stdout.write(`contenu « ${locale} » : ${content.questions.length} questions, OK\n`);
}

mkdirSync(join(root, 'schemas'), { recursive: true });
writeFileSync(
  join(root, 'schemas', 'content.schema.json'),
  JSON.stringify(zodToJsonSchema(ContentSchema, 'content'), null, 2) + '\n',
);
