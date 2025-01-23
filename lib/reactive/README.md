# @li3/reactive

## Usage

```ts
import { reactive } from '@li3/reactive';

const callback = () => console.log('A property has changed');
const object = { name: '', address: { street: "", number: 0 } };
const reactiveObject = reactive(object, callback);

// any value assigned to the reactive object properties (including objects) triggers a callback
reactiveObject.name = 'Alice'
reactiveObject.address = { street: '1 Main St', number: 123 };
reactiveObject.address.number = 456;
```