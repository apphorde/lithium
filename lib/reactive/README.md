# @li3/reactive

## Usage

```ts
import { reactive } from '@li3/reactive';

const callback = console.log;
const target = {};
const liveObject = reactive(target, callback)

// any value assigned to target object triggers a callback, recursively
target.name = 'joe'
target.address = { street: '1 Main St', number: 123 };
target.address.number = 456;
```