import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { loadContent } from '../src/content/load-node';
import type { Answers } from '../src/engine/conditions';

export const content = loadContent('fr');

export interface Profile {
  file: string;
  name: string;
  answers: Answers;
}

const PROFILES_DIR = join(__dirname, 'fixtures', 'profils');

export const profiles: Profile[] = readdirSync(PROFILES_DIR)
  .filter((f) => f.endsWith('.yaml'))
  .map((file) => {
    const raw = parse(readFileSync(join(PROFILES_DIR, file), 'utf8')) as { name: string; answers: Answers };
    return { file, ...raw };
  });

export function profile(file: string): Profile {
  const found = profiles.find((p) => p.file === file);
  if (!found) throw new Error(`profil introuvable : ${file}`);
  return found;
}
