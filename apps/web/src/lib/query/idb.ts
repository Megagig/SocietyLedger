/**
 * The saved query cache lives in IndexedDB (not localStorage: it is larger, and does not block the page while it is read or written).
 * If IndexedDB is not available (private mode, an old browser, server rendering) every call quietly does nothing and the app just
 * runs without a saved cache.
 */
const DB_NAME = 'societyledger-query';
const STORE = 'cache';

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Matches the storage shape the TanStack async persister expects. */
export const idbStorage = {
  async getItem(key: string): Promise<string | null> {
    const value = await run<string>('readonly', (store) => store.get(key));
    return typeof value === 'string' ? value : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await run('readwrite', (store) => store.put(value, key));
  },
  async removeItem(key: string): Promise<void> {
    await run('readwrite', (store) => store.delete(key));
  },
};

export const cacheStorageKey = (scopeId: string) => `rq.web.${scopeId}`;
