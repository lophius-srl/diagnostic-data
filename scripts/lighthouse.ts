import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { loadContent } from '../src/content/load-node';
import { encodeShare } from '../src/lead/share';

/**
 * Audit Lighthouse (mobile) des pages principales. Local uniquement (pas dans la CI, par sobriété).
 * Prérequis : l'app tourne (make dev-full → http://localhost:8788, ou make preview → 4173) et Chrome est installé.
 * Usage : npm run lighthouse [-- http://localhost:4173]
 */
const base = process.argv[2] ?? 'http://localhost:8788';
const content = loadContent('fr');
const profile = parse(readFileSync(join('tests', 'fixtures', 'profils', 'negoce-12.yaml'), 'utf8')) as {
  answers: Record<string, string>;
};
const pages = {
  accueil: '/',
  question: '/#/diagnostic',
  resultats: `/#/r/${encodeShare(content, profile.answers, true)}`,
  confidentialite: '/#/confidentialite',
};
// Chrome refuse de démarrer en root sans --no-sandbox (conteneurs Linux) ; inutile sous Windows.
const chromeFlags = process.getuid?.() === 0 ? '--headless=new --no-sandbox' : '--headless=new';
const dir = mkdtempSync(join(tmpdir(), 'lighthouse-'));
let ok = true;
for (const [name, path] of Object.entries(pages)) {
  const out = join(dir, `${name}.json`);
  execFileSync(
    'npx',
    [
      'lighthouse',
      `${base}${path}`,
      `--chrome-flags=${chromeFlags}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--output=json',
      `--output-path=${out}`,
      '--quiet',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  const report = JSON.parse(readFileSync(out, 'utf8')) as { categories: Record<string, { score: number }> };
  const scores = Object.fromEntries(Object.entries(report.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
  if (Object.values(scores).some((s) => s < 90)) ok = false;
  process.stdout.write(`${name.padEnd(16)} ${JSON.stringify(scores)}\n`);
}
process.stdout.write(ok ? 'Toutes les pages sont à 90 ou plus.\n' : 'Au moins un score est sous 90.\n');
process.exit(ok ? 0 : 1);
