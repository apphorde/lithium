import { reactive } from "@li3/reactive";
import { describe, it, mock } from "node:test";
import assert from "assert";

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

    assert.strictEqual(
      3,
      callback.mock.callCount(),
      "callback was not triggered correctly"
    );
  });
});
