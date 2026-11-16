import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { CONTENT_FILES, ContentSchema, type Content } from './schema';
import { validateContent } from './validate';

/** Charge, valide et vérifie la cohérence du contenu d'une langue (Node uniquement : build et tests). */
export function loadContent(locale = 'fr', root = join(process.cwd(), 'content')): Content {
  const raw: Record<string, unknown> = {};
  for (const [key, file] of Object.entries(CONTENT_FILES)) {
    raw[key] = parse(readFileSync(join(root, locale, file), 'utf8'));
  }
  const parsed = ContentSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')} : ${i.message}`).join('\n');
    throw new Error(`Contenu « ${locale} » invalide :\n${details}`);
  }
  const errors = validateContent(parsed.data);
  if (errors.length > 0) {
    throw new Error(`Contenu « ${locale} » incohérent :\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
  return parsed.data;
}
