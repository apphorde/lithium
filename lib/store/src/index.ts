import { computed } from "@li3/web";

const stores = new Map();
const stateRef = Symbol("#");

export function defineStore(name: string, factory: CallableFunction) {
  return function () {
    if (stores.has(name)) {
      return stores.get(name);
    }

    const store = factory();
    const refs = [];
    const view = {};

    Object.defineProperty(view, "toJSON", {
      enumerable: false,
      configurable: false,
      value: () => Object.fromEntries(refs.map((f) => [f, view[f]])),
    });

    Object.defineProperty(view, stateRef, {
      enumerable: false,
      configurable: false,
      get() {
        return view;
      }
    });

    const error = new Error("Store values are read-only");

    for (const [name, value] of Object.entries(store)) {
      if (typeof value === "function") {
        view[name] = value;
      } else {
        refs.push(name);
        Object.defineProperty(view, name, {
          enumerable: true,
          get() {
            return store[name].value;
          },
          set() {
            throw error;
          },
        });
      }
    }

    stores.set(name, view);
    return view;
  };
}

export function setState(store, state) {
  const view = store[stateRef];
  Object.assign(view, state);
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
