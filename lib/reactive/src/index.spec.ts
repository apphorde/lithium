import { reactive, signal, effect } from "./index.js";
import { describe, it, mock } from "node:test";
import assert from "node:assert";

describe("reactive values", () => {
  it("should observe a change in an object", () => {
    const callback = mock.fn();
    const target = {
      name: "Alice",
      address: { street: "", number: 1 },
    };

    const reactiveObject = reactive(target, callback);

    // any value assigned to target object triggers a callback, recursively
    reactiveObject.name = "Bob";
    reactiveObject.address = { street: "1 Main St", number: 123 };
    reactiveObject.address.number = 456;

    assert.strictEqual(3, callback.mock.callCount(), "callback was not triggered correctly");
  });
});

describe("signal", () => {
  it("should observe change in a signal", async () => {
    const values = [];
    const source1 = signal(1);
    const source2 = signal(10);
    const computed1 = effect(() => source1.value + source2.value);
    effect(() => values.push(computed1.value));
    const computed2 = effect(() => source1.value + computed1.value);
    effect(() => values.push(computed2.value));

    assert.strictEqual(11, computed1.value, "computed1 ref value is incorrect");
    assert.strictEqual(12, computed2.value, "computed2 ref value is incorrect");
    assert.deepStrictEqual(values, [11, 12], "callback was not triggered correctly");

    values.length = 0;
    source1.value = 5;
    assert.strictEqual(15, computed1.value, "computed1 ref value is incorrect after dependency change");
    assert.deepStrictEqual(values, [15, 20, 20], "callback was not triggered correctly");

    source2.value = 5;
    assert.strictEqual(10, computed1.value, "computed1 ref value is incorrect after dependency change");
    assert.strictEqual(15, computed2.value, "computed2 ref value is incorrect after dependency change");
  });

  it("should observe change in a signal with reactive objects", async () => {
    const values = [];
    const source1 = signal({ user: { name: "alice" } });
    const source2 = signal({ user: { name: "bob" } }, { shallow: true });

    effect(() => values.push(source1.value.user.name));
    effect(() => values.push(source2.value.user.name));

    effect(() => console.log(source1.value));
    effect(() => console.log(source2.value));

    // values represent the signal projections the first time the effect is called
    assert.deepStrictEqual(values, ["alice", "bob"], "callback was not triggered correctly");

    // values includes a deep-watched object change
    source1.value.user.name = "mary";
    assert.deepStrictEqual(values, ["alice", "bob", "mary"], "reactive object was not triggered correctly");

    // values includes an object swap
    source1.value = { user: { name: "billy" } };
    assert.deepStrictEqual(
      values,
      ["alice", "bob", "mary", "billy"],
      "reactive object swap was not triggered correctly",
    );

    // values do not include a shallow-watched object change
    source2.value.user.name = "john";
    assert.deepStrictEqual(values, ["alice", "bob", "mary", "billy"], "shallow object should not trigger");
  });
});
