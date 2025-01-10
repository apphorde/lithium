# @li3/scope

A scope is an encapsulation of functions that can later be executed with a dynamic context.
Once a scope is linked to a context object, each expression is available as a function.

```js
import { addProperties, addExpression, createScope, compile, bind } from '@li3/scope';

const scope = createScope();

// declare properties that are expected to be available in the context
addProperties(scope, ["counter", "increase"]);

// add JS expressions
const counter = addExpression(scope, `'Counter is at ' + counter + '.'`);
const increase = addExpression(scope, `increase()`);

// no more properties or expressions after it's compiled!
compile(scope);

// bind to a live state
const state = {
  counter: 1,
  increase() {
    state.counter++;
  }
};

const bindings = bind(scope, state);

console.log(bindings[counter]()); // Counter is at 1.
bindings[increase]();
console.log(bindings[counter]()); // Counter is at 2.
```

## API

### `createScope(parent?) => Scope`

Creates a new scope. Optionally, provide a parent scope to reuse its expressions and properties.

### `addProperty(scope, property)` / `addProperty(scope, properties)`

Declare properties that will be later available in a context

### `addExpression(scope, expression)`

Declare expressions to compile in this scope

### `compile(scope)`

Compile this scope (from strings into functions)

### `bind(scope, context) => BoundContext`

Link a pre-compiled scope to a context object. A scope can be linked multiple times to different context objects.

## `configure(scope, options)`

Options:

- `unwrap`: a function used to unwrap values before execution. Useful if any value needs to be transformed before
it is passed onto expressions.
