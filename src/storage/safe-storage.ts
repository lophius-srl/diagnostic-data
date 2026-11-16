/**
 * Accès au stockage local qui ne plante jamais : navigation privée, stockage plein ou bloqué
 * basculent sur une mémoire temporaire, et `persistent` indique à l'interface de prévenir l'utilisateur.
 */
export interface SafeStorage {
  readonly persistent: boolean;
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createSafeStorage(getBackend: () => Storage | undefined = defaultBackend): SafeStorage {
  const memory = new Map<string, string>();
  let backend: Storage | undefined;
  try {
    backend = getBackend();
    if (backend) {
      const probe = '__lophius_probe__';
      backend.setItem(probe, '1');
      backend.removeItem(probe);
    }
  } catch {
    backend = undefined;
  }

  return {
    persistent: backend !== undefined,
    get(key) {
      try {
        return backend ? backend.getItem(key) : (memory.get(key) ?? null);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    set(key, value) {
      memory.set(key, value);
      try {
        backend?.setItem(key, value);
      } catch {
        // Stockage plein ou retiré en cours de route : la copie en mémoire suffit pour la session.
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        backend?.removeItem(key);
      } catch {
        // Rien à faire : l'entrée sera ignorée au prochain chargement.
      }
    },
  };
}

function defaultBackend(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
