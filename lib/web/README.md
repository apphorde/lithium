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

## Dependency Injection and Providers

A classic example of tab/tab container:

```ts
import { inject, provide, onInit, defineProps } from '@lithium/web';

// common token between components
export const Controller = Symbol();

// children can inject from parent components in the DOM tree
function tab() {
  const props = defineProps('tabid');
  const controller = inject(Controller);

  onInit(function() {
    controller.register(props.tabid);
  })
}

// parents can provide values via Symbols or unique references
function tabContainer() {
  const tabs = [];

  provide(Controller, {
    register(id) {
      tabs.push(id);
    }
  });
}

// NOTE: the order of registration is important: the parent
// must be registered first!
createComponent('x-tabcontainer', { setup: tabContainer });
createComponent('x-tab', { setup: tab });

```

```html
<x-tabcontainer>
  <x-tab tabid="one"></x-tab>
  <x-tab tabid="two"></x-tab>
</x-tabcontainer>
```