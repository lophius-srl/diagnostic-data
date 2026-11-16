import { describe, expect, it } from 'vitest';
import { createSafeStorage } from '../src/storage/safe-storage';
import { loadProgress, saveProgress, STORAGE_KEY, emptyProgress } from '../src/storage/progress';
import { content } from './helpers';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

class BrokenStorage extends MemoryStorage {
  override setItem(): void {
    throw new DOMException('quota', 'QuotaExceededError');
  }
}

describe('stockage local robuste', () => {
  it('utilise le stockage du navigateur quand il est disponible', () => {
    const backend = new MemoryStorage();
    const s = createSafeStorage(() => backend);
    s.set('a', '1');
    expect(s.persistent).toBe(true);
    expect(backend.getItem('a')).toBe('1');
  });

  it('bascule en mémoire si le stockage est bloqué, sans erreur', () => {
    const s = createSafeStorage(() => new BrokenStorage());
    expect(s.persistent).toBe(false);
    s.set('a', '1');
    expect(s.get('a')).toBe('1');
  });

  it('bascule en mémoire si l’accès au stockage lève une exception', () => {
    const s = createSafeStorage(() => {
      throw new Error('SecurityError');
    });
    expect(s.persistent).toBe(false);
    expect(s.get('x')).toBeNull();
  });
});

describe('sauvegarde de la progression', () => {
  it('relit ce qui a été sauvegardé', () => {
    const s = createSafeStorage(() => new MemoryStorage());
    saveProgress(s, { ...emptyProgress(content), answers: { secteur: 'services' }, cursor: 1 });
    expect(loadProgress(s, content)).toMatchObject({ answers: { secteur: 'services' }, cursor: 1 });
  });

  it('ignore une sauvegarde corrompue', () => {
    const s = createSafeStorage(() => new MemoryStorage());
    s.set(STORAGE_KEY, '{pas du json');
    expect(loadProgress(s, content)).toBeUndefined();
  });

  it('écarte les réponses qui n’existent plus et repart au début si le contenu a changé', () => {
    const s = createSafeStorage(() => new MemoryStorage());
    s.set(
      STORAGE_KEY,
      JSON.stringify({
        contentVersion: 'ancienne',
        answers: { secteur: 'services', taille: 'inconnue', outils: ['odoo', 'zzz'], disparue: 'x' },
        cursor: 7,
      }),
    );
    const p = loadProgress(s, content);
    expect(p?.answers).toEqual({ secteur: 'services', outils: ['odoo'] });
    expect(p?.cursor).toBe(0);
  });
});
