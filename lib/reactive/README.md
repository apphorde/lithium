# @li3/reactive

Bring life to objects and react to their changes

## Usage

Observe an object:

```ts
import { reactive } from "@li3/reactive";

const callback = () => console.log("A property has changed");
const object = { name: "", address: { street: "", number: 0 } };
const reactiveObject = reactive(object, callback);

// any value assigned to the reactive object properties (including objects) triggers a callback
reactiveObject.name = "Alice";
reactiveObject.address = { street: "1 Main St", number: 123 };
reactiveObject.address.number = 456;

// get back the original object
const originalObject = unwrap(reactiveObject);
```

Observe value holders (Refs):

```js
import { signal, effect, observer } from "@li3/reactive";

const value1 = signal(1);
const value2 = signal(2);
const computed = effect(() => value1.value + value2.value);

observer(computed, console.log);

// outputs "3" to console

value2.value = 5;

// outputs "6" to console
```
