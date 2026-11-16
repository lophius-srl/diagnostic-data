import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Exporte les leads de la base D1 en CSV (séparateur « ; », lisible par Excel en français).
 * Usage : npm run leads:export            (base en ligne)
 *         npm run leads:export -- --local (base locale de développement)
 * Le fichier est écrit dans exports/ (ignoré par git : il contient des données personnelles).
 */
const local = process.argv.includes('--local');
const columns = [
  'created_at',
  'first_name',
  'last_name',
  'email',
  'company',
  'bce',
  'phone',
  'score_global',
  'level',
  'hidden_cost',
  'consent_at',
  'consent_version',
  'email_status',
  'share_url',
  'answers_json',
];
const output = execFileSync(
  'npx',
  [
    'wrangler',
    'd1',
    'execute',
    'diagnostic-leads',
    local ? '--local' : '--remote',
    '--json',
    '--command',
    `SELECT ${columns.join(', ')} FROM leads ORDER BY created_at DESC`,
  ],
  { encoding: 'utf8', shell: process.platform === 'win32' },
);
const rows = (JSON.parse(output) as { results: Record<string, unknown>[] }[])[0]?.results ?? [];
const cell = (v: unknown) => {
  const text = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csv = '﻿' + [columns.join(';'), ...rows.map((r) => columns.map((c) => cell(r[c])).join(';'))].join('\r\n');
mkdirSync('exports', { recursive: true });
const file = join('exports', `leads-${new Date().toISOString().slice(0, 10)}.csv`);
writeFileSync(file, csv);
process.stdout.write(`${rows.length} lead(s) exporté(s) dans ${file}\n`);
