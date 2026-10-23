type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const preferenceKey = 'hamiya-remember-session';

// Supabase uses this adapter for both sessions and PKCE verifiers. Unremembered
// sign-ins stay in this tab; successful writes remove the other stored copy.
export function createAuthStorage(local: StorageLike, session: StorageLike) {
  const memory = new Map<string, string>();
  const read = (storage: StorageLike, key: string) => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const remove = (storage: StorageLike, key: string) => {
    try {
      storage.removeItem(key);
    } catch {
      /* Storage can be disabled. */
    }
  };
  let remember = read(session, preferenceKey) !== 'false';
  return {
    remembers: () => remember,
    setRemember(value: boolean) {
      remember = value;
      try {
        session.setItem(preferenceKey, String(value));
      } catch {
        /* Keep the in-memory choice. */
      }
    },
    getItem(key: string) {
      return memory.get(key) ?? read(session, key) ?? read(local, key);
    },
    setItem(key: string, value: string) {
      memory.delete(key);
      const target = remember ? local : session;
      try {
        target.setItem(key, value);
      } catch {
        memory.set(key, value);
      }
      remove(remember ? session : local, key);
    },
    removeItem(key: string) {
      memory.delete(key);
      remove(local, key);
      remove(session, key);
    },
  };
}

function browserStorage(kind: 'localStorage' | 'sessionStorage'): StorageLike {
  try {
    return window[kind];
  } catch {
    const values = new Map<string, string>();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    };
  }
}
export const authStorage = createAuthStorage(
  browserStorage('localStorage'),
  browserStorage('sessionStorage'),
);
