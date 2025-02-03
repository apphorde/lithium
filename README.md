# Lithium

A batteries-included library to build reactive interfaces.

## Introduction

Lithium (Li³) is a lightweight element (get it?) library to author web components with the least amount of deviation from Web API's.

## Importing the library

We can use 2 ESM features to load li3 and it's sub-modules: [**import map**](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) and [**module script type**](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#applying_the_module_to_your_html)

```html
<!-- the import map will let any @li3 package to load with a short name -->
<script type="importmap">
  { "imports": { "@li3/": "https://cdn.li3.dev/@li3/" } }
</script>

<!-- The script tag loads the main library and initializes all components -->
<script type="module" src="https://cdn.li3.dev/@li3/web"></script>
```

## Template Syntax

The [content template element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template) provides an API to include markup in a webpage without rendering it. The `template` elements also have a `.contents` property, which allows us to clone the entire template without modifying the original nodes.

Another imporant aspect of templates is that scripts and styles are not activated either. We can include a `<script>` element inside a template and later use that source [as a module](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

### `<script setup>` and `component` attribute

Now that we know templates, let's expand on that API. A component can be authored in plain HTML, and even inserted into a webpage directly into the source.

Here's what we introduce _on top of the standard API_:

- add a `component` attribute to give `li3` the custom element name
- optionally, add `shadow-dom` attribute to specify [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) API options.
- inside the template, add a `<script setup>` tag to write the component logic. In that script, use [import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#importing_features_into_your_script) statements to load `li3` and export a default value with a `setup` function:

```html
<template component="ui-card" shadow-dom="open">
  <div class="card">
    <span class="card-title">{{ title }}</span>
    <slot></slot>
  </div>
  <script setup>
    import { defineProp } from '@li3/web';
    export default function uiCard() {
      defineProp('title');
    }
  </script>
  <style>
    .card {
      padding: 1rem;
      margin: 1rem auto;
      border-radius: 0.5rem;
      border: 1px solid #333;
      backgroud-color: white;
    }
    .card-title {
      color: #999;
      text-transform: upppercase;
      font-size: 0.75rem;
      display: inline-block;
      padding: 0.5rem 0;
    }
  </style>
</template>
```

## Component Syntax

Now that we know how to declare components, let's look at the template syntax for property bindings and events.

### Text interpolation

Use two curly brackets to mark text areas to interpolate:

```html
<div>Hello, {{ name }}!</div>
```

### How to bind a property to a value?

Add `bind-` prefix to a property name and an expression in the attribute to evaluate.
For properties that need `camelCase` syntax, like `innerText`, use a dash format instead: `inner-text`.
Acronyms like `inner-html` and `base-url` also work.

```html
<tag bind-property="expression">
```

### How to bind an attribute to a value?

The same way you bind a property:

`attr-name="expression"`

### Toggle a CSS class

Add the class name after the `class-` prefix to add/remove it based on the value of an expression

`class-font-bold="booleanValue"`

Invalid attribute name characters cannot be used for class bindings.

### Listen to an event

Any event listener can be attached to an element with the `on-` prefix.
Event flags can be added after the event name, separated with a dot.
Two arguments are provided to an event handler: `$event` and `$flags`

`on-click.prevent="expression($event, $flags)"`

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

## Other tools and helpers

### tpl(html: string)

At runtime, the `tpl` function can help with parsing an HTML text.

```ts
import { tpl, createComponent, defineProps } from "@li3/web";
const template = tpl`<div>Hello, {{name}}!</div>`;
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
