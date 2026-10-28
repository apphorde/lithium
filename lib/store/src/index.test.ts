import { describe, expect, it } from "vitest";
import { computed, ref } from "@li3/web";
import { defineStore, persist, storeToRefs } from "./index.js";

describe("storeToRefs", () => {
  it("returns stable computed refs for store values and preserves actions", () => {
    const count = ref(1);
    const useCounter = defineStore(`storeToRefs-${Math.random()}`, () => ({
      count,
      label: "Count",
      metadata: { unit: "items" },
      increment() {
        count.value += 1;
      },
    }));
    const store = useCounter();
    const refs = storeToRefs(store);

    expect(refs.count).toBe(refs.count);
    expect(refs.count.value).toBe(1);
    expect(refs.label.value).toBe("Count");
    expect(refs.metadata.value).toEqual({ unit: "items" });
    expect(refs.increment).toBe(store.increment);

    store.increment();

    expect(refs.count.value).toBe(2);
    expect(Object.keys(refs)).toEqual(Object.keys(store));
  });

  it("exposes the named plugin promise and restores then persists selected state", async () => {
    const storageValues = new Map<string, string>([["_store_plugin-test", JSON.stringify({ count: 4, doubled: 99 })]]);
    const storage = {
      getItem(key: string) {
        return storageValues.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        storageValues.set(key, value);
      },
      removeItem(key: string) {
        storageValues.delete(key);
      },
      clear() {
        storageValues.clear();
      },
    };
    const useCounter = defineStore(
      "plugin-test",
      () => {
        const count = ref(0);
        return {
          count,
          doubled: computed(() => count.value * 2),
          increment() {
            count.value += 1;
          },
        };
      },
      {
        plugins: {
          persist: persist({ storage, pick: ["count"], debounce: 0 }),
        },
      },
    );
    const store = useCounter();
    const persistReady: Promise<void> = store.$persist;

    await persistReady;

    expect(store.count).toBe(4);
    expect(store.doubled).toBe(8);
    expect(storeToRefs(store).$persist).toBe(store.$persist);

    store.increment();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(JSON.parse(storageValues.get("_store_plugin-test") ?? "null")).toEqual({ count: 5 });
  });
});
