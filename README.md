# Lithium

A batteries-included library to build reactive interfaces.

## Introduction

Lithium (Li³) is a lightweight element (get it?) library to author web components with the least amount of deviation from Web API's.

## Template Syntax

A component can be authored in plain HTML, and even inserted into a webpage directly into the source.
That's because of the `<template>` tag: we can write _inert_ HTML inside a template, and replicate it as a custom element.

Here's what we introduce _on top of the Web API_:

- add a `component` attribute to tell `li3` what is the custom element name
- optionally, add `shadow-dom` attribute to specify [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) API options.

```html
<template component="ui-card">
  <div class="rounded-lg bg-white border my-4 p-4">
    <slot></slot>
  </div>
</template>
```

## Component Syntax

### Interpolate text

```html
<div>Hello, {{ name }}!</div>
```

### Bind a property to a value

`bind-property="expression"`

> Note: Use dash-case for camelCase properties: `bind-inner-html="expression"`

### Bind an attribute to a value

`attr-name="expression"`

### Toggle a CSS class

`class-font-bold="boolean"`

Invalid attribute name characters cannot be used for class bindings.

### Listen to an event

`on-click="expression($event)"`

### Create reference to a node

This happens in two parts:

- Template side:

```html
<div ref="refName"></div>
```

- Setup function side:

```js
import { ref } from "@li3/web";

function setup() {
  const refName = ref();
  return { refName };
}
```

## Usage

At runtime, the `tpl` function can help with parsing an HTML text.

```ts
import { tpl, createComponent, defineProps } from "@li3/web";

const template = tpl`<div>Hello, {{name}}!</div>`;

function setup() {
  defineProps(["name"]);
}

export default createComponent("user-greeting", { setup, template });
```

## Dependency Injection and Providers

A classic example of tabs and a container:

```ts
import { inject, provide, onInit, defineProps } from "@li3/web";

// common token between components
export const Controller = Symbol();

// children can inject from parent components in the DOM tree
function tab() {
  const props = defineProps("tabid");
  const controller = inject(Controller);

  onInit(function () {
    controller.register(props.tabid);
  });
}

// parents can provide values via Symbols or unique references
function tabContainer() {
  const tabs = [];

  provide(Controller, {
    register(id) {
      tabs.push(id);
    },
  });
}

// NOTE: the order of registration is important: the parent
// must be registered first!
createComponent("x-tabcontainer", { setup: tabContainer });
createComponent("x-tab", { setup: tab });
```

```html
<x-tabcontainer>
  <x-tab tabid="one"></x-tab>
  <x-tab tabid="two"></x-tab>
</x-tabcontainer>
```

## Component lifecycle

When `mount(rootElement, { setup, template })` is called, these lifecycle events are executed:

```text
component setup is executed (setup)
     V
DOM structure creation starts (createDom)
     V
check every DOM node (createElement)
     V
check every attribute of a node (applyAttribute)
     V
append structure to document (appendDom)
     V
component starts (init)
     V
a property changes (change)
     V
component is removed from DOM (destroy)
```

## Plugins

Plugins can hook into any of the lifecycle stages and run side-effects or modify the component

```js
import { plugins } from "@li3/web";

plugins.use({
  setup(state) {
    // right after component state is created
  },
  createDom($el, domTree) {
    // when all elements are created, but not appended yet
  },
  createElement($el, domNode) {
    // for each node in the new dom tree (element or text node)
  },
  applyAttribute($el, element, attribute, value) {
    // when an attribute is being applied to an HTMLElement
  },
  appendDom({ element }) {
    // when the new dom tree is appended to the root element
  },
  init({ element }) {
    // when all bindings are ready
  },
  update($el, property, oldValue, newValue) {
    // a prop has changed
  },
  destroy({ element }) {
    // right before a node is detached from DOM and destroyed
    // only works with custom elements using `disconnectedCallback` hook
  },
});
```

## Documentation, examples and guides

See https://li3.dev/ for examples, quick intro and more.
