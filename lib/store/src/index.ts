import { computed, effect, isRef, isWritableRef, unwrap } from "@li3/web";
import type { Signal } from "@li3/web";

const stores = new Map();
const storePlugins = new WeakMap();
const error = new Error("Store values are read-only");
const storeKey = (name) => `_store_${name}`;

export type MaybePromise<T> = T | Promise<T>;

export interface StoreStorage {
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
  removeItem(key: string): MaybePromise<void>;
  clear(): MaybePromise<void>;
}

export interface StorePluginContext {
  name: string;
  state: Record<string, any>;
}

export type StorePlugin = (context: StorePluginContext) => MaybePromise<void>;

export interface StoreOptions<Plugins extends Record<string, StorePlugin> = Record<string, StorePlugin>> {
  plugins?: Plugins;
}

type PublicValue<Value> = Value extends Signal<infer T> ? T : Value;
type PublicStore<State extends Record<string, any>, Plugins extends Record<string, StorePlugin>> = {
  readonly [Key in keyof State]: PublicValue<State[Key]>;
} & {
  readonly [Key in keyof Plugins as Key extends string ? `$${Key}` : never]: Promise<void>;
};

export interface PersistOptions {
  storage: StoreStorage;
  key?: string;
  pick?: string[];
  debounce?: number;
  onError?: (error: unknown) => void;
}

export function defineStore<State extends Record<string, any>, Plugins extends Record<string, StorePlugin> = {}>(
  storeName: string,
  factory: () => State,
  options: StoreOptions<Plugins> = {},
): () => PublicStore<State, Plugins> {
  return function () {
    if (stores.has(storeName)) {
      return stores.get(storeName) as PublicStore<State, Plugins>;
    }

    const store = factory();
    const readOnlyProperties = {};
    const plugins = Object.entries(options.plugins ?? {});

    for (const [pluginKey] of plugins) {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(pluginKey)) {
        throw new Error(`Invalid store plugin key: ${pluginKey}`);
      }

      const property = `$${pluginKey}`;
      if (property in store) {
        throw new Error(`Store property "${property}" is reserved for the "${pluginKey}" plugin`);
      }
    }

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

    const pluginProperties = new Set();
    let previousPlugin = Promise.resolve();

    for (const [pluginKey, plugin] of plugins) {
      const property = `$${pluginKey}`;
      const ready = previousPlugin.then(() => plugin({ name: storeName, state: store }));
      previousPlugin = ready.catch(() => undefined);
      pluginProperties.add(property);

      Object.defineProperty(readOnlyProperties, property, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: ready,
      });

      ready.catch(() => undefined);
    }

    storePlugins.set(readOnlyProperties, pluginProperties);
    stores.set(storeName, readOnlyProperties);
    return readOnlyProperties as PublicStore<State, Plugins>;
  };
}

export function definePersistentStore<State extends Record<string, any>>(
  storeName: string,
  storage: StoreStorage,
  factory: () => State,
) {
  return defineStore(storeName, factory, {
    plugins: {
      persist: persist({ storage }),
    },
  });
}

export function persist(options: PersistOptions): StorePlugin {
  const { storage, key, pick, debounce = 10, onError = console.error } = options;

  return async ({ name, state }) => {
    const storageKey = key ?? storeKey(name);
    const keys =
      pick ??
      Object.entries(state)
        .filter(([, value]) => isWritableRef(value))
        .map(([name]) => name);
    const refs = keys.map((name) => [name, state[name]]).filter(([, value]) => isWritableRef(value));
    const cached = await storage.getItem(storageKey);

    if (cached !== null) {
      const restored = JSON.parse(cached);
      if (restored !== null && typeof restored === "object") {
        for (const [name, value] of Object.entries(restored)) {
          const target = state[name];
          if (keys.includes(name) && isWritableRef(target)) {
            target.value = value;
          }
        }
      }
    }

    let timer: ReturnType<typeof setTimeout>;
    effect(
      () => JSON.stringify(Object.fromEntries(refs.map(([name, signal]) => [name, signal.value]))) ?? "{}",
      (snapshot) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            Promise.resolve(storage.setItem(storageKey, snapshot)).catch(onError);
          } catch (error) {
            onError(error);
          }
        }, debounce);
      },
      { immediate: true },
    );
  };
}

export function storeToRefs(store) {
  const refs = Object.create(Object.getPrototypeOf(store));
  const pluginProperties = storePlugins.get(store) ?? new Set();

  for (const key of Reflect.ownKeys(store)) {
    const value = store[key];

    Object.defineProperty(refs, key, {
      configurable: false,
      enumerable: Object.prototype.propertyIsEnumerable.call(store, key),
      writable: false,
      value: typeof value === "function" || pluginProperties.has(key) ? value : computed(() => store[key]),
    });
  }

  return refs;
}

export function useIndexedDbStorage(name: string) {
  const dbName = "li3Store_" + name;
  const storeName = "kv_" + name;
  let database: Promise<IDBDatabase> | undefined;

  function getDB() {
    if (database) {
      return database;
    }

    database = new Promise((resolve, reject) => {
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

    return database;
  }

  async function getStore(mode: IDBTransactionMode) {
    const db = await getDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  function wrap<T>(f: () => IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
      const request = f();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const storage: StoreStorage = {
    async setItem(key, value) {
      const store = await getStore("readwrite");
      await wrap(() => store.put(value, key));
    },

    async getItem(key) {
      const store = await getStore("readonly");
      return (await wrap<string | undefined>(() => store.get(key))) ?? null;
    },

    async removeItem(key) {
      const store = await getStore("readwrite");
      await wrap(() => store.delete(key));
    },

    async clear() {
      const store = await getStore("readwrite");
      await wrap(() => store.clear());
    },
  };

  return storage;
}
