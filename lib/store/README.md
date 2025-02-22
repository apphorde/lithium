# @li3/store

Create and manage state with reactive properties.

## Usage

Declare a store in a module

```js
// count-store.js
import { createStore } from '@li3/store';

const reducers = {
  add(state, action) {
    state.count += 1;
  },
  remove(state, action) {
    state.count -= 1;
  },
};

const effects = {
  add(state) {
    console.log('New count:', state.count);
  },
  remove(state) {
    console.log('New count:', state.count);
  },
};

export default createStore({ count: 0 }, { reducers, effects });
```

Then import the store and dispatch actions:

```js
import countStore from './count-store.js';

// it's safe to import the same store many times
const { select, dispatch } = countStore;

dispatch('add'); // logs 1
dispatch('add'); // logs 2
dispatch('remove'); // logs 1 again

// counter is a computed value
const counter = select((s) => s.count);
```

## Transactions

Stores can push multiple changes and run side effects within a single update cycle.
That can be done with a `.transaction()` call in the store:

```js

store.events.addEventListener('commit', (state) => {...})
store.transaction(async () => {
  await store.dispatch('increment', 1);
  await store.dispatch('increment', 10);
  await store.dispatch('decrement', 5);
});
```

All intermediate states are not propagated to any selector.
When all actions are completely dispatched, the state is pushed into the store and all computed values reflect the changes.
