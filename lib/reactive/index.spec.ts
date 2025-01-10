import assert from "assert";
import { describe, it, mock } from "node:test";
import { reactive, observe, ref, isRef, shallowRef, unref, diffWatcher } from "./index.js";

describe("reactive", () => {
  it("should create a shallow reactive object", () => {
    const target = { name: "joe", age: 21 };
    const reactiveObject = reactive(target);
    const observer = mock.fn();

    reactiveObject.name = "paul";
    assert(observer.mock.callCount() === 0, "mock was called too early");

    observe(reactiveObject, observer);
    reactiveObject.name = "alice";
    reactiveObject.age = 18;

    assert(observer.mock.callCount() === 2, "mock was not called by reactive object");
  });

  it("should create a reactive object", () => {
    const target = { name: "joe", age: 21, address: { lines: ["street", "city"] } };
    const reactiveObject = reactive(target);
    const observer = mock.fn();

    observe(reactiveObject, observer);
    reactiveObject.name = "alice";
    assert(observer.mock.callCount() === 1, "mock was not called by reactive object");

    reactiveObject.address.lines = ["other st"];
    assert(observer.mock.callCount() === 2, "mock was not called by deep property");
  });
});

describe("ref", () => {
  it("should create a signal object", () => {
    const target = ref(123);
    assert(target.value === 123, "target value is not 123");
    assert(unref(target) === 123, "target value is not 123");
    assert(isRef(target) === true, "isRef failed");

    const observer = mock.fn();
    observe(target, observer);

    target.value = 345;
    assert(observer.mock.callCount() === 1, "ref update does not trigger observer");
  });

  it("should create a signal object with deep observers", () => {
    const target = ref({ name: "alice" });
    assert(target.value.name === "alice", "target value is not 123");
    assert(isRef(target) === true, "isRef failed");

    const observer = mock.fn();
    observe(target, observer);

    target.value.name = "bob";
    assert(observer.mock.callCount() === 1, "ref update does not trigger observer");
  });

  it("should create a signal object with shallow observers", () => {
    const target = shallowRef({ name: "alice" });
    assert(target.value.name === "alice", "target value is not 123");
    assert(isRef(target) === true, "isRef failed");

    const observer = mock.fn();
    observe(target, observer);

    target.value.name = "bob";
    assert(observer.mock.callCount() === 0, "ref update triggered for a shallow observer");
  });
});

describe("diffWatcher", () => {
  it("should watch a value getter", async () => {
    let value = 1;
    const getter = () => value;
    const observer = mock.fn();

    const trigger = diffWatcher(getter, observer);

    await trigger();
    assert(observer.mock.callCount() === 1, "observer not called");

    await trigger();
    assert(observer.mock.callCount() === 1, "observer called without a change");

    value = 2;
    await trigger();
    assert(observer.mock.callCount() === 2, "observer not called after a change");
  });
});
