# @li3/store

Create composable stores from Li3 signals. Store values are exposed read-only; actions returned by the factory can update
the private refs.

```js
import { defineStore } from "@li3/store";
import { ref } from "@li3/web";

export const useCounter = defineStore("counter", () => {
  const count = ref(0);

  return {
    count,
    increment() {
      count.value += 1;
    },
  };
});

const counter = useCounter();
counter.increment();
console.log(counter.count); // 1
```

`storeToRefs(store)` returns computed refs for store values and keeps actions as functions.

## Plugins and persistence

Plugins are registered by name. Each plugin gets the store name and its private factory result, and its completion promise
is exposed as `$<pluginName>` on the returned store.

```js
import { defineStore, persist, useIndexedDbStorage } from "@li3/store";
import { ref } from "@li3/web";

const storage = useIndexedDbStorage("my-app");

export const useProfile = defineStore(
  "profile",
  () => {
    const profile = ref(null);
    return { profile };
  },
  {
    plugins: {
      persist: persist({ storage, pick: ["profile"] }),
    },
  },
);

const profile = useProfile();
await profile.$persist; // Wait for saved state to be loaded.
```

`persist()` saves selected writable refs as JSON. By default, it persists all top-level writable refs. The storage key
defaults to `_store_<name>`; `key`, `pick`, and `debounce` can be set in its options. `$persist` waits for initial
hydration and setup, not for later debounced writes.

`useIndexedDbStorage(name)` returns an async, key-value storage with `getItem`, `setItem`, `removeItem`, and `clear`
methods. The methods match the Web Storage API and return promises. The `StoreStorage` interface also accepts synchronous
Storage implementations such as `localStorage`; persistence awaits either form.
