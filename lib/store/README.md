# @li3/store

Create a reactive store with an initial state, and dispatch actions

## Usage

```js
import { useStore } from "@li3/store";

const reducers = {
  add(state, action) {
    state.count += 1;
  },
  remove(state, action) {
    state.count -= 1;
  },
};

// here it's safe to reuse this store's value
const store = useStore({ count: 0 }, { reducers });
const { useSelectors, dispatch } = store;

// now we get into state selection via live Ref instances.
// every Ref has to be detached after use to prevent memory leaks
const { select, unref } = useSelectors();
const counter = select((s) => s.count);

dispatch("add"); // +1
dispatch("add"); // +1
dispatch("remove"); // -1

console.log(counter.value); // 1

// detach all live bindings created with select()
unref();
```
