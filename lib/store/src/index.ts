import { computed, watch, isRef, isReadOnlyRef, unwrap } from "@li3/web";

const stores = new Map();
const error = new Error("Store values are read-only");
const storeKey = (name) => `$store${name}`;

export function defineStore(storeName: string, factory: CallableFunction) {
  return function () {
    if (stores.has(storeName)) {
      return stores.get(storeName);
    }

    const store = factory();
    const storageKey = storeKey(storeName);
    const readOnlyProperties = {};
    const refs = [];

    for (const [name, value] of Object.entries(store)) {
      if (isRef(value)) {
        refs.push(value);
      }

      Object.defineProperty(readOnlyProperties, name, {
        enumerable: true,
        get() {
          return unwrap(value);
        },
        set() {
          throw error;
        },
      });
    }

    const c = computed(() => refs.map((x) => x.value));
    refs.length = 0;
    let timer;

    watch(c, () => {
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          localStorage.setItem(storageKey, JSON.stringify(readOnlyProperties)),
        10,
      );
    });

    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        const values = JSON.parse(cached);
        const entries = Object.entries(values);

        for (const [key, value] of entries) {
          const k = store[key];
          if (isRef(k) && !isReadOnlyRef(k)) {
            k.value = value;
          }
        }
      } catch {}
    }

    stores.set(storeName, readOnlyProperties);
    return readOnlyProperties;
  };
}

export function storeToRefs(store) {
  const refs = {};

  for (const [name, value] of Object.entries(store)) {
    if (typeof value !== "function") {
      Object.defineProperty(refs, name, {
        get() {
          return computed(() => store[name]);
        },
      });
    }
  }

  return refs;
}
