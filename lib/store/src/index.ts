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

export function definePersistentStore(
  storeName: string,
  factory: CallableFunction,
  o: { parse?: (s: string) => any; serialize?: (v: any) => string; skip?: string[] },
) {
  return function () {
    const { parse = JSON.parse, serialize = JSON.stringify, skip = [] } = o;
    const store = defineStore(storeName, factory);
    const storageKey = storeKey(storeName);
    const refs = Object.entries(store).filter(([k, v]) => isRef(v) && !isReadOnlyRef(v) && skip.includes(k) === false);

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
        timer = setTimeout(() => localStorage.setItem(storageKey, serialize(store)), 10);
      },
    );

    const cached = localStorage.getItem(storageKey);

    if (cached) {
      try {
        const values = parse(cached);
        const entries = Object.entries(values);

        for (const [key, value] of entries) {
          const k = store[key];
          if (isRef(k) && !isReadOnlyRef(k)) {
            k.value = value;
          }
        }
      } catch {}
    }
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
