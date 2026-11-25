import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { loadContent } from '../src/content/load-node';
import { evaluate, type Answers } from '../src/engine/conditions';

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

/** Générateur pseudo-aléatoire déterministe (mulberry32) : les tests restent reproductibles. */
export function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simule des PME qui répondent au hasard, en suivant le parcours adaptatif réel
 * (seules les questions visibles reçoivent une réponse).
 */
export function simulatedAnswers(count: number, seed = 42): Answers[] {
  const random = seededRandom(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  const result: Answers[] = [];
  for (let i = 0; i < count; i++) {
    const answers: Record<string, string | string[]> = {};
    for (const q of content.questions) {
      if (q.showIf && !evaluate(q.showIf, answers)) continue;
      if (q.type === 'single') answers[q.id] = pick(q.options).id;
      else {
        const regular = q.options.filter((o) => !o.exclusive);
        const chosen = regular.filter(() => random() < 0.2).map((o) => o.id);
        answers[q.id] = chosen.length > 0 && random() > 0.05 ? chosen : [pick(q.options.filter((o) => o.exclusive)).id];
      }
    }
    result.push(answers);
  }
  return result;
}

/** Nombre de mots d'un texte (apostrophes et tirets internes comptent dans le mot). */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}
