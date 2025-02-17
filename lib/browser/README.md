# @li3/browser

Browser APIs used to declare Li3 components

## Using it with HTML

```html
<template component="my-counter">
  <div>
    Count: {{ count }}
    <button on-click="add()">+</button>
    <button on-click="remove()">-</button>
  </div>
  <script setup>
    import { ref } from '@li3/browser';

    export default function () {
      const count = ref(0);

      return {
        count,
        add() { count.value++; },
        remove() { count.value--; },
      };
    }
  </script>
</template>
```

## Using it with ESM

```js
import { ref, createComponent } from '@li3/browser';

export const template = `
<div>
  Count: {{ count }}
  <button on-click="add()">+</button>
  <button on-click="remove()">-</button>
</div>
`

export function setup() {
  const count = ref(0);

  return {
    count,
    add() { count.value++; },
    remove() { count.value--; },
  };
}

createComponent('my-counter', { template, setup });
```
