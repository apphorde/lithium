import { describe, expect, it } from "vitest";
import { ref } from "@li3/web";
import { defineStore, storeToRefs } from "./index.js";

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
});
