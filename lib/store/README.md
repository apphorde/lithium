# @lithium/store

## Usage

Create a store with an initial state, and dispatch

```ts
import { useStore } from '@lithium/store';

const formData = {
  name: '',
  age: 0
};

const actions = {
  reset() {

  }
}
const { store, dispatch, commit } = useStore(formData, );
```