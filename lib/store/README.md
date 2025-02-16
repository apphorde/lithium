# @li3/store

Create and manage state with reactive properties.

## Usage

Declare a store in a module

```js
// count-store.js

import { useStore } from "@li3/store";

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
    console.log("New count:", state.count);
  },
  remove(state) {
    console.log("New count:", state.count);
  },
};

export default useStore({ count: 0 }, { reducers, effects });
```

Then import the store and dispatch actions:

```js
import countStore from "./count-store.js";

// it's safe to import the same store many times
const { useSelectors, dispatch } = countStore;

dispatch("add"); // logs 1
dispatch("add"); // logs 2
dispatch("remove"); // logs 1 again

// for components, we select state values via live Ref instances.
// every Ref has to be detached after use to prevent memory leaks
const { select, detach } = useSelectors();
const counter = select((s) => s.count);

// detach all live bindings created with select()
detach();
```
