# @lithium/web

Run-time API for running custom elements with live bindings, props, custom events and whatnot.

## Template Syntax

### Interpolate text

```html
<div>Hello, {{ name }}!</div>
```

### Bind a property to a value

- Short form: `:property="expression"`
- Long form: `bind-property="expression"`
- Using dash-case for camelCase properties: `bind-inner-html="expression"`

### Toggle a CSS class

- Short form: `.class.font-bold="boolean"`
- Long form: `class-font-bold="boolean"`

Invalid attribute name characters cannot be used for class bindings.

### Listen to an event

- Short form: `@click="expression($event)"`
- Long form: `on-click="expression($event)"`

### Create reference to a node

This happens in two parts:

- Template side:

```html
<div ref="refName"></div>
```

- Setup function side:

```js
import { ref } from '@lithium/web';

function setup() {
  const refName = ref();
  return {refName};
}
```

## Usage

At runtime, the `html` helper function can help with parsing an HTML text, as long as the "long form" syntax is used for bindings and events.

```ts
import { html, createComponent, defineProps } from '@lithium/web';

const template = html`<div>Hello, {{name}}!</div>`;

function setup() {
  defineProps(['name']);
}

export default createComponent('user-greeting', { setup, template });
```
