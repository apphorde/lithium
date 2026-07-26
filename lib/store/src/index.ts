import { computed, effect, isRef, isReadOnlyRef, unwrap } from '@li3/web';

const stores = new Map();
const error = new Error('Store values are read-only');
const storeKey = (name) => `_store_${name}`;

export function defineStore(storeName: string, factory: CallableFunction) {
  return function () {
    if (stores.has(storeName)) {
      return stores.get(storeName);
    }

    const store = factory();
    const readOnlyProperties = {};

    for (const [name, value] of Object.entries(store)) {
      if (isRef(value)) {
        Object.defineProperty(readOnlyProperties, name, {
          enumerable: true,
          get() {
            return unwrap(value);
          },
          set() {
            throw error;
          },
        });
      } else {
        Object.defineProperty(readOnlyProperties, name, {
          configurable: false,
          enumerable: false,
          writable: false,
          value,
        });
      }
    }

    stores.set(storeName, readOnlyProperties);
    return readOnlyProperties;
  };
}

export function definePersistentStore(storeName: string, factory: CallableFunction) {
  const storeFactory = defineStore(storeName, factory);
  const storage = useIndexedDbStorage(storeName);
  const storageKey = storeKey(storeName);

  return function () {
    const store = storeFactory();
    const refs: any[] = Object.values(store).filter((v) => isRef(v) && !isReadOnlyRef(v));
    let timer: any;

    effect(
      () => {
        if (refs.length) {
          refs.map((x) => x.value);
          refs.length = 0;
        }

        return Math.random();
      },
      () => {
        clearTimeout(timer);
        timer = setTimeout(() => storage.setItem(storageKey, store), 10);
      },
    );

    storage.getItem(storageKey).then((cached) => {
      const entries = Object.entries(cached || {});

      for (const [key, value] of entries) {
        const k = store[key];
        if (isRef(k) && !isReadOnlyRef(k)) {
          k.value = value;
        }
      }
    });

    return store;
  };
}

export function storeToRefs(store) {
  return new Proxy(store, {
    get(_t, p) {
      const v = store[p];
      if (typeof v !== 'function') {
        return computed(() => store[v]);
      }

      return v;
    },
  });
}

export function useIndexedDbStorage(name: string) {
  const dbName = 'li3Store_' + name;
  const storeName = 'kv_' + name;

  function getDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };

      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (e: any) => reject(e.target.error);
    });
  }

  async function getStore(mode) {
    const db: any = await getDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  function wrap(f) {
    return new Promise((resolve, reject) => {
      const request = f();
      request.onsuccess = (e: any) => resolve(e.target?.result ?? null);
      request.onerror = (e: any) => reject(e.target.error);
    });
  }

  return {
    async setItem(key, value) {
      const store = await getStore('readwrite');
      return wrap(() => store.put(value, key));
    },

    async getItem(key) {
      const store = await getStore('readonly');
      return wrap(() => store.get(key));
    },

    async removeItem(key) {
      const store = await getStore('readwrite');
      return wrap(() => store.delete(key));
    },

    async clear() {
      const store = await getStore('readwrite');
      return wrap(() => store.clear());
    },
  };
}
