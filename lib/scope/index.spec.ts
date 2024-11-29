import { describe, it } from "node:test";
import assert from "assert";
import { addExpression, addProperties, addProperty, bind, compile, configure, createScope } from "./index";

describe("html parser", () => {
  it("should create an execution scope", () => {
    const scope = createScope();
    assert.notEqual(scope, undefined, "scope is undefined");

    addProperties(scope, ["counter", "increase"]);

    const counter = addExpression(scope, `counter`);
    const increase = addExpression(scope, `increase()`);

    compile(scope);

    const context = {
      counter: 1,
      increase() {
        context.counter++;
      },
    };

    const bindings = bind(scope, context);

    assert.equal(bindings[counter](), 1, "counter is not correct");
    bindings[increase]();
    assert.equal(bindings[counter](), 2, "counter is not correct");
  });

  it("should allow to unwrap values", () => {
    const scope = createScope();

    addProperty(scope, "ref");
    configure(scope, {
      unwrap(ref) {
        return ref.value;
      },
    });

    const refValue = addExpression(scope, `ref`);
    compile(scope);

    const context = {
      ref: { value: 123 },
    };

    const bindings = bind(scope, context);
    assert.equal(bindings[refValue](), 123, "unwrap not working");
  });

  it("should use the same scope in multiple contexts", () => {
    const scope = createScope();
    assert.notEqual(scope, undefined, "scope is undefined");

    addProperties(scope, ["counter", "increase"]);

    const counter = addExpression(scope, `counter`);
    const increase = addExpression(scope, `increase()`);

    compile(scope);

    const one = {
      counter: 1,
      increase() {
        one.counter++;
      },
    };

    const two = {
      counter: 1,
      increase() {
        one.counter++;
      },
    };

    const contextOne = bind(scope, one);
    const contextTwo = bind(scope, two);

    assert.equal(contextOne[counter](), 1, "counter is not correct");
    assert.equal(contextTwo[counter](), 1, "counter is not correct");

    contextOne[increase]();

    assert.equal(contextOne[counter](), 2, "counter is not correct");
    assert.equal(contextTwo[counter](), 1, "counter is not correct");
  });
});
