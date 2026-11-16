import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { loadContent } from '../src/content/load-node';
import type { Answers } from '../src/engine/conditions';
import { renderReportNode } from '../src/pdf/render-node';

/** Génère le rapport PDF des profils de test dans exports/ (relecture du contenu sans navigateur). */
const content = loadContent('fr');
const dir = join('tests', 'fixtures', 'profils');
mkdirSync('exports', { recursive: true });
for (const file of readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
  const profile = parse(readFileSync(join(dir, file), 'utf8')) as { name: string; answers: Answers };
  const pdf = await renderReportNode(content, profile.answers, { company: profile.name.split(',')[0] ?? 'PME' });
  const out = join('exports', `rapport-${file.replace('.yaml', '')}.pdf`);
  writeFileSync(out, pdf);
  process.stdout.write(`${out} (${Math.round(pdf.length / 1024)} Ko)\n`);
}
