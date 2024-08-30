# @lithium/web

Browser package to run an app

## Usage

**Javascript-only API:**

```ts
import { parse as html } from '@lithium/html-parser';
import { createComponent, defineProps } from '@lithium/web';

const template = html`<div part="component">Hello, {{name}}!</div>`;

function setup() {
  defineProps(['name']);
}

export default createComponent('user-greeting', { setup, template });
```

**From a single-file component:**

`user-greeting.html`:

```html
<template>
  <div>Hello, {{name}}!</div>
</template>

<script setup="">
  import { defineProps } from '@lithium/web';

  defineProps(['name']);
</script>
```

`user-greeting.mjs`:

```js
import { parseSFC } from '@lithium/sfc';
import source from './user-greeting.html';

export default createComponent('user-greeting', parseSFC(source));

```
