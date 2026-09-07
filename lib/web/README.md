# @li3/web

Primitives for general-purpose web applications in the modern web. A reactive, template-driven component
library built on web standards (custom elements, templates, shadow DOM, CSS modules) with a concise
programming interface.

## Public API

**Reactive values and references**:

```txt
    ref(value)                               Creates a reactive wrapper to a value (like a signal)
    computed(fn)                             Creates a computed property that updates when its dependencies change (e.g. other computed or refs)
    templateRef(refName: string)             Creates a ref and finds an element with a `ref={refName}` attribute in the view
    hook(value)                              Creates a reactive wrapper using React style hooks (e.g. const [value, setValue] = hook(initialValue))
    watch(ref, callback)                     Watches a reactive source and calls the callback when it changes
    effect(fn, effectFn)                     Runs a function and tracks its dependencies, re-running the effectFn when they change (wraps fn in computed)
    reactive(object, effect)                 Creates a reactive version of an object that triggers an effect when it changes
```

**Lifecycle Hooks:**

```txt
    onInit(fn)                               Called just before the component is initialized
    onDestroy(fn)                            Called just before the component is destroyed
    onUpdate(fn)                             Called just before the component inputs have changed (i.e. one or more props have changed)

```

**Component setup definitions:**

```txt
    defineProp(name, options)                Defines a prop for a component with the given name and options (type, default value, etc.)
    defineEvent(name)                        Defines a custom event that the component can emit with the given name
```

**Component definition:**

```txt
    defineComponent(name, options)           Defines a custom element with the given name and options (template, shadowDom and setup function)
    mount(targetElement, options)            Mounts a component to a target element with the given options
    unwrap(object)                           Unwraps a reactive reference or computed property to get its underlying value
    load(href)                               Loads one or more components (as HTML) from a source and registers the  as a custom element
```

**Internals:**

```txt
    compare(a, b)                            Compares two values for equality, handling reactive references and computed properties
    canBeObserved(object)                    Checks if an object can be observed for reactivity (internal use only)
    isRef(x)                                 Check if a value was created with ref()
```

**Extensions:**

```txt
    use(rule)                                Add a new node and attribute matcher. `use({ match(node, attribute, value) {}, exec(node, attribute, value, context) {} })`
```

Set `window.name` to `debug` in any page to attach component context to components.

---

# Complete Guide

The rest of this document is a complete, example-driven description of everything `@li3/web` can do.
It is written to be the only documentation needed to design and build applications with this framework.

## Table of contents

1. [Mental model](#1-mental-model)
2. [Getting started](#2-getting-started)
3. [Template syntax reference](#3-template-syntax-reference)
   - [Interpolation](#31-interpolation--expression-)
   - [Events](#32-event-bindings-on-eventmodifierexpression)
   - [Property bindings](#33-property-bindings-bind-propmodifierexpression)
   - [Attribute bindings](#34-attribute-bindings-attr-namemodifierexpression)
   - [Class bindings](#35-class-bindings-class-namename2expression)
   - [Style bindings](#36-style-bindings-style-propertyexpression)
   - [Conditional rendering](#37-conditional-rendering-template-ifexpression)
   - [List rendering](#38-list-rendering-template-foritem-of-items)
   - [Element refs](#39-element-refs-refname--templaterefname)
   - [Emitting events from templates](#310-emitting-events-from-templates-emit)
   - [Skipping subtrees](#311-skipping-subtrees-do-not-render)
4. [Template expressions: rules and semantics](#4-template-expressions-rules-and-semantics)
5. [Declaring components in HTML](#5-declaring-components-in-html)
   - [The `component` template](#51-the-component-template)
   - [The `app` template](#52-the-app-template)
   - [Setup scripts](#53-setup-scripts-script-setup)
   - [Declarative JSON state](#54-declarative-json-state-script-state)
   - [Declarative refs](#55-declarative-state-refs-ref)
   - [Styles](#56-styles-style-and-link-relstylesheet)
   - [Component dependencies](#57-component-dependencies-link-relcomponent)
   - [Shadow DOM and slots](#58-shadow-dom-and-slots)
6. [Full component examples](#6-full-component-examples)
7. [Reactivity in depth](#7-reactivity-in-depth)
8. [Props](#8-props)
9. [Events between components](#9-events-between-components)
10. [Lifecycle hooks](#10-lifecycle-hooks)
11. [Loading components at runtime](#11-loading-components-at-runtime-load)
12. [Programmatic mounting](#12-programmatic-mounting-mount)
13. [The extension system](#13-the-extension-system-use)
14. [Feature flags and debugging](#14-feature-flags-and-debugging)
15. [Complete syntax cheat sheet](#15-complete-syntax-cheat-sheet)
16. [Gotchas and rules of thumb](#16-gotchas-and-rules-of-thumb)

---

## 1. Mental model

An application is a tree of **custom elements**. Each component is:

- a **template** (plain HTML with binding syntax),
- an optional **setup function** that returns the template's context (state + behavior),
- optional **styles** (adopted stylesheets),
- optional **props** (inputs) and **events** (outputs).

Data flows **down via props** (`defineProp` + `bind-*`) and **up via events** (`defineEvent` + `on-*`).
State is held in **signals** (`ref`, `computed`); templates track signal reads and update the DOM
automatically when they change.

Two ways to declare components:

1. **Declaratively in HTML** — `<template component="my-element">` in the page (auto-initialized) or in
   files fetched with `load(href)`. This is the primary path.
2. **Programmatically in JS** — `mount(element, { template, setup })` or `defineComponent(name, options)`.

## 2. Getting started

Import the module in a page. Auto-initialization runs shortly after module evaluation (on
`DOMContentLoaded`), which:

1. defines every in-document `<template component="...">` as a custom element,
2. fetches and registers every `<link rel="component" href="...">`,
3. mounts every `<template app>` in place.

```html
<script type="importmap">
  { "imports": { "@li3/": "https://cdn.li3.dev/@li3/" } }
</script>
<script type="module">
  import '@li3/web';
</script>

<template app>
  <h1>{{ title }}</h1>
  <button on-click="increment()">Count: {{ count }}</button>

  <script setup>
    import { ref } from '@li3/web';

    export default function () {
      const title = ref('Hello Lithium');
      const count = ref(0);
      const increment = () => count.value++;

      return { title, count, increment };
    };
  </script>
</template>
```

A standalone loader script that injects the import map and imports `@li3/web` is also published as
`@li3/web/loader`. If your page already has an import map, add `"@li3/": "https://cdn.li3.dev/"`
to it manually instead.

## 3. Template syntax reference

Templates are **plain HTML**. Special meaning is given to:

- `{{ ... }}` inside text nodes,
- attributes starting with `on-`, `bind-`, `attr-`, `class-`, `style-`,
- `<template>` elements carrying an `if` or `for` attribute,
- the plain `ref` attribute.

After a binding is processed, its attribute is **removed from the DOM** (kept when the `debug` feature
flag is on). Only **one rule applies per attribute** — the first matching rule wins.

### 3.1 Interpolation: `{{ expression }}`

Any text node containing `{{` becomes reactive. Each `{{ expression }}` is spliced into a template
literal; the whole text node re-renders whenever any dependency of the expressions changes.

```html
<p>Count: {{ count }}</p>
<p>{{ count }} doubled is {{ count * 2 }}</p>
<p>{{ user.name }} ({{ user.roles.join(', ') }})</p>
```

- Expressions are arbitrary JavaScript, evaluated against the component context.
- Refs are **auto-unwrapped**: `{{ count }}` renders `count.value`.
- `undefined` renders as an empty string.
- The **entire text node** is replaced on update, so put each interpolation in its own element if you
  need granular structure: `<p>Hello <b>{{ name }}</b>!</p>`.

### 3.2 Event bindings: `on-<event>[.<modifier>...]="expression"`

Adds an event listener. The expression is compiled to a function receiving `$event`.

```html
<button on-click="increment()">+1</button>
<input on-input="query = $event.target.value" />
<form on-submit.prevent="save()">...</form>
<div on-click.self="close()">...</div>
<a href="/x" on-click.stop.prevent="navigate($event)">link</a>
```

- `<event>` is a plain DOM event name: `click`, `input`, `change`, `submit`, `keydown`, `update`, ...
- Also listens to **custom events emitted by child components**: `on-save="onSave($event)"` — payload
  is in `$event.detail`.
- **Modifiers** (dot-suffixed, combinable):
  - `.stop` — calls `event.stopPropagation()`
  - `.prevent` — calls `event.preventDefault()`
  - `.self` — handler only runs if `event.target` is the element itself

Handlers call functions from the setup context. Direct assignment to context variables is not possible
(read-only context, see [§4](#4-template-expressions-rules-and-semantics)) — call methods instead.

### 3.3 Property bindings: `bind-<prop>[.<modifier>...]="expression"`

Sets a DOM **property** (not an attribute). Re-evaluated whenever the expression's dependencies change.

```html
<input bind-value="name" />
<video bind-current-time="position"></video>
<div bind-scroll-top="scrollY"></div>
<pre bind-innerhtml="highlightedCode"></pre>
```

- The property name is **camelCased**: `bind-scroll-top` → `el.scrollTop`.
- Name mappings: `bind-innerhtml` → `el.innerHTML`, `bind-baseuri` → `el.baseURI`,
  `bind-class` → `el.className`.
- **`.bool` modifier** — toggles a boolean *attribute* instead of setting a property:

  ```html
  <button bind-disabled.bool="isSaving">Save</button>
  <section bind-hidden.bool="!isVisible">...</section>
  ```

- **Object syntax for `class`** — when the expression *source text* starts with `{`, each key is
  toggled as a class name by the truthiness of its value:

  ```html
  <div bind-class="{ active: isActive, disabled: isDisabled }"></div>
  ```

- **Object syntax for `style`** — sets style properties (keys camelCased):

  ```html
  <div bind-style="{ color: themeColor, 'font-size': size + 'px' }"></div>
  ```

This is also how you pass data **into child components** (see [§8](#8-props)):

```html
<count-trigger bind-trigger="currentValue"></count-trigger>
```

### 3.4 Attribute bindings: `attr-<name>[.<modifier>...]="expression"`

Sets an HTML **attribute** (stringified). Re-evaluated on change.

```html
<button attr-aria-label="buttonLabel">?</button>
<div attr-data-state="state" attr-title="tooltip"></div>
<input attr-aria-invalid="hasError" />
```

- **`.bool` modifier** — toggles the attribute's presence:

  ```html
  <button attr-disabled.bool="!isValid">Submit</button>
  ```

- Attribute names must match `/^[a-zA-Z_][a-zA-Z0-9\-_:.]*$/`, otherwise the binding is ignored.
- Use `attr-*` for attributes (ARIA, `data-*`, `title`, SVG attributes); use `bind-*` for DOM
  properties (`value`, `checked`, `scrollTop`, component props).

### 3.5 Class bindings: `class-<name>[.<name2>...]="expression"`

Toggles one or more classes based on the truthiness of the expression.

```html
<div class-warning="count > 10">...</div>
<button class-font-bold.text-lg="counter > 2">...</button>
<li class-selected="item.id === selectedId">...</li>
```

Multiple classes in a single attribute are separated by dots: `class-a.b="x"` toggles `a` and `b`.
(A hyphenated name like `class-font-bold` is a single class `font-bold`.)

For object-style class maps use `bind-class="{ ... }"` ([§3.3](#33-property-bindings-bind-propmodifierexpression)).

### 3.6 Style bindings: `style-<property>="expression"`

Sets an inline style property. Re-evaluated on change.

```html
<div style-color="themeColor">...</div>
<div style-background-image="bgUrl">...</div>
<div style-transform="'translateX(' + x + 'px)'">...</div>
```

The property name is camelCased: `style-background-image` → `el.style.backgroundImage`.
For object style maps use `bind-style="{ ... }"`.

### 3.7 Conditional rendering: `<template if="expression">`

Renders its content only while the expression is truthy.

```html
<template if="count > 0">
  <p>You've clicked {{ count }} times</p>
</template>

<template if="user">
  <user-card bind-user="user"></user-card>
</template>
```

- Must be a literal `<template>` element with an `if` attribute.
- The template is replaced by a comment anchor (`<!--if: expression-->`); content is cloned into the
  DOM when the expression turns truthy and removed when it turns falsy.
- Content inside is fully linked to the context (all bindings work).
- There is **no `else` / `else-if`** — use two `<template if>` blocks with complementary conditions,
  or computed expressions.
- DOM insertion is asynchronous (microtask-ish `setTimeout`); don't query the new DOM synchronously
  right after changing the condition.

### 3.8 List rendering: `<template for="item of items">`

Renders the content once per item of an iterable.

```html
<ul>
  <template for="todo of todos">
    <li class-done="todo.done" on-click="toggle(todo)">{{ todo.title }}</li>
  </template>
</ul>
```

With an index, use array destructuring syntax:

```html
<template for="[user, i] of users">
  <tr>
    <td>{{ i + 1 }}</td>
    <td>{{ user.name }}</td>
  </tr>
</template>
```

- The separator is **`of`** (not `in`). The right side is any expression; it is wrapped in
  `Array.from(expression || [])`, so arrays and iterables work, and `null`/`undefined` render nothing.
- The template is replaced by a comment anchor (`<!--for: item of items-->`).
- Inside the loop body, `item` (and the optional index) are available as context variables. Item values
  are auto-unwrapped refs, so `{{ todo.title }}` just works.
- **DOM reuse by position**: when the array changes, existing rows are kept and their item refs are
  updated in place (`item.value = newItem`). Rows beyond the new length are removed; new rows are
  cloned and appended. There is **no keying / `track by`** — reordering an array rewrites the item of
  each row at its index rather than moving DOM nodes.
- Nested loops work; inner loops shadow outer variables:

  ```html
  <template for="group of groups">
    <h2>{{ group.name }}</h2>
    <template for="[member, j] of group.members">
      <p>{{ j }}: {{ member.name }} ({{ group.name }})</p>
    </template>
  </template>
  ```

### 3.9 Element refs: `ref="name"` + `templateRef(name)`

Mark any element with a plain `ref` attribute, then grab it in setup with `templateRef`:

```html
<template component="search-box">
  <input ref="input" on-input="onInput($event)" />
  <button on-click="input.focus()">Focus</button>

  <script setup>
    import { templateRef, onInit } from '@li3/web';

    export default function () {
      const input = templateRef('input');

      onInit(() => input.value.focus());

      function onInput(e) { /* ... */ }

      return { input, onInput };
    };
  </script>
</template>
```

- `templateRef('input')` returns a **shallow ref holding the element** (`input.value` is the
  `HTMLInputElement`).
- The ref is also merged into the template context under the same name, so templates can use it
  directly (e.g. `on-click="input.focus()"`).

### 3.10 Emitting events from templates: `$$emit`

Every component context contains an injected `$$emit(name, value)` function that dispatches a
`CustomEvent` on the host element:

```html
<button on-click="$$emit('save', { id: item.id })">Save</button>
```

Equivalent to using `defineEvent` in setup (see [§9](#9-events-between-components)), but callable
directly from template expressions.

### 3.11 Skipping subtrees: `do-not-render`

Any element carrying the `do-not-render` attribute is skipped by the binding walker — neither it nor
its children are processed. Useful for raw content that may contain `{{ ... }}` sequences:

```html
<pre do-not-render>Literal mustache: {{ not-evaluated }}</pre>
```

## 4. Template expressions: rules and semantics

All binding expressions (`{{ }}`, `on-*`, `bind-*`, `attr-*`, `class-*`, `style-*`, `if`, `for`)
follow the same rules:

1. **Plain JavaScript.** Expressions are compiled with `new Function`. `if` is wrapped in
   `Boolean(...)`; `for` sources in `Array.from(... || [])`; text interpolations become template
   literals.
2. **The context is the setup's return value** merged with props (`defineProp`) and template refs
   (`templateRef` / `ref="..."` attributes), plus the injected `$$emit` function. Only context keys
   whose names literally appear in the expression are in scope for that expression.
3. **Refs auto-unwrap on read.** A context value created with `ref`/`computed` is transparently
   replaced by its `.value` in templates: `{{ count }}`, `count > 2`, `items.length` all read the
   unwrapped value. Refs also implement `Symbol.toPrimitive`, so arithmetic/coercion works even when a
   ref slips through (`count + 2`).
4. **The context is read-only.** Assigning to a top-level context variable in a template
   (`on-click="count = count + 1"`) **throws** `"View contexts are read-only"`. Call setup methods
   instead: `on-click="increment()"`. Two exceptions:
   - Mutating *inside* an object works via deep reactivity: `on-input="user.name = $event.target.value"`
     mutates the reactive object held by the `user` ref.
   - Host element props can be mutated through `$event.target` or element refs:
     `on-click="$event.target.trigger++"`.
5. **Reactivity is automatic.** Each binding re-evaluates its expression when any signal read during
   evaluation changes. DOM updates are scheduled asynchronously (a ~5ms queue).
6. **Functions are values.** Methods returned from setup (`increment`, `save`, ...) are available by
   name; call them in event handlers: `on-click="increment()"`.

## 5. Declaring components in HTML

### 5.1 The `component` template

```html
<template component="my-element">
  <!-- view markup with any template syntax -->
  <p>{{ message }}</p>

  <!-- optional behavior -->
  <script setup>
    import { ref } from '@li3/web';
    export default function () {
      const message = ref('hi');
      return { message };
    };
  </script>
</template>
```

- The element name must be a valid custom element name (contain a dash; SVG-reserved names like
  `font-face` are rejected).
- In-document `template[component]` blocks are registered automatically on page load. Each `<my-element>`
  in the page (or added later) mounts the template.
- Optional `shadow-dom` attribute enables shadow DOM: `shadow-dom="open"`, `shadow-dom="closed"`, or a
  JSON `ShadowRootInit` such as `shadow-dom='{"mode":"open","delegatesFocus":true}'`.
- The `<template>` tag itself is not rendered; its content is cloned into each element instance.
- A template may contain, in any order: view markup, one `<script setup>`, one `<script state>`,
  any number of `<style>` / `<link rel="stylesheet">`, `<link rel="component">`, and `<ref>` tags.
  All of these special children are **removed** from the template before mounting and never appear in
  the rendered output.

### 5.2 The `app` template

`<template app>` is a component without a name that mounts immediately at its own location (into a
`<div style="display: contents">` inserted where the template was, which is then removed). Use it for
the application root — or several independent apps on one page.

```html
<template app>
  <h1>{{ title }}</h1>
  <script setup>
    import { ref } from '@li3/web';
    export default function () {
      return { title: ref('My App') };
    };
  </script>
</template>
```

### 5.3 Setup scripts: `<script setup>`

The component's behavior module. Its **default export is the setup function**, executed once per
component instance. Everything the template needs must be **returned** as an object — forgetting
`return` yields an empty context.

```html
<script setup>
  import { ref, computed, defineProp, defineEvent, onInit, templateRef } from '@li3/web';

  export default function () {
    const initial = defineProp('initial', { default: 0 });
    const count = ref(initial.value);
    const doubled = computed(() => count.value * 2);
    const onSave = defineEvent('save');
    const input = templateRef('input');

    const increment = () => count.value++;
    const save = () => onSave(count.value);

    onInit(() => console.log('mounted'));

    return { count, doubled, increment, save, input };
  };
</script>
```

- Setup scripts are ES modules: top-level `import` works (e.g. `from '@li3/web'` via import map, or
  relative URLs resolved against the page / the file the template was loaded from).
- Instead of inline code, an external file can be referenced:
  `<script setup src="./logic.js"></script>` (resolved relative to the component file).
- The script runs once per element instance when the element connects to the DOM.

### 5.4 Declarative JSON state: `<script state>`

Components with no behavior can skip the setup script and declare their initial context as JSON:

```html
<template app>
  <script state type="application/json">
    {
      "title": "Facts",
      "facts": [
        { "title": "One", "content": "..." },
        { "title": "Two", "content": "..." }
      ]
    }
  </script>

  <h1>{{ title }}</h1>
  <template for="fact of facts">
    <article>
      <h3>{{ fact.title }}</h3>
      <p>{{ fact.content }}</p>
    </article>
  </template>
</template>
```

When **both** `state` and `setup` exist, each JSON entry is applied onto the setup result: writable
refs receive `.value = entry`, other keys are overwritten. This lets HTML authors inject content into
a scripted component:

```html
<template app>
  <script state type="application/json">{ "title": "Overridden" }</script>
  <script setup>
    import { ref } from '@li3/web';
    export default function () {
      return { title: ref('Default title') };
    };
  </script>
  <h1>{{ title }}</h1>
</template>
```

### 5.5 Declarative state refs: `<ref>`

Individual reactive values can be declared inside a template with `<ref>` tags (removed before mount):

```html
<template app>
  <ref name="count" value="0" setter="setCount"></ref>
  <ref name="user" value='{"name":"Ada","admin":true}'></ref>

  <p>{{ count }} — {{ user.name }} ({{ user.admin }})</p>
  <button on-click="setCount(count + 1)">+1</button>
</template>
```

- `name` — the context variable (a `ref`).
- `value` — parsed smartly: `'true'`/`'false'` → boolean, numbers/JSON/objects/arrays via expression
  evaluation, anything else → string.
- `setter` (optional) — creates a setter function under that name: `setCount(v)` sets `count.value = v`.
  Without a setter, mutations must go through a setup function (or object mutation like `user.name = x`).

### 5.6 Styles: `<style>` and `<link rel="stylesheet">`

Style tags and stylesheet links inside a component template are converted to `CSSStyleSheet`s and added
to `adoptedStyleSheets` of the shadow root (or the document, when no shadow DOM) at mount time:

```html
<template component="ui-card" shadow-dom="open">
  <div class="card"><slot></slot></div>

  <style>
    .card { padding: 1rem; border: 1px solid #ccc; border-radius: 0.5rem; }
  </style>
  <link rel="stylesheet" href="./card.css" />
</template>
```

- Relative `href`s resolve against the component file URL.
- CSS is loaded as a CSS module (`import ... with { type: 'css' }`) with an `@import url(...)` fallback.
- Stylesheets are shared/cached per URL.

Additionally, `loadCss(href, options?)` can be called **during setup** to load and adopt a stylesheet
programmatically (`{ adopt: false }` skips adoption and just returns `Promise<CSSStyleSheet>`).

### 5.7 Component dependencies: `<link rel="component">`

A component file (or the page itself) can declare dependencies on other component files:

```html
<!-- in the page head: loaded and registered at startup -->
<link rel="component" href="./components/ui-kit.html" />

<!-- inside a component template: loaded when the component is defined -->
<template component="user-dashboard">
  <link rel="component" href="./widgets.html" />
  <user-card></user-card>
</template>
```

URLs inside a loaded file resolve relative to that file. Loads are cached per resolved URL.

### 5.8 Shadow DOM and slots

With `shadow-dom`, the template renders into the element's shadow root and native `<slot>` works:

```html
<template component="ui-card" shadow-dom="open">
  <div class="card">
    <span class="card-title">{{ title }}</span>
    <slot></slot>
    <slot name="footer"></slot>
  </div>
  <style>.card { padding: 1rem; }</style>
</template>

<ui-card title="Hello">
  <p>Default slot content</p>
  <footer slot="footer">Named slot content</footer>
</ui-card>
```

Without `shadow-dom`, content renders in light DOM and `<slot>` has no effect (there is no custom
slot implementation).

## 6. Full component examples

### 6.1 Counter (single file app)

```html
<script type="importmap">{ "imports": { "@li3/": "https://cdn.li3.dev/@li3/" } }</script>
<script type="module">import '@li3/web';</script>

<template app>
  <h1>{{ title }}</h1>
  <div class-warning="count > 10">
    <p>Count: <strong>{{ count }}</strong> (double: {{ doubled }})</p>
    <template if="count > 0">
      <p>You've clicked {{ count }} times</p>
    </template>
  </div>
  <button on-click="increment()" bind-disabled.bool="count > 5">Increment</button>
  <button on-click="reset()">Reset</button>

  <script setup>
    import { ref, computed } from '@li3/web';

    export default function () {
      const title = ref('Counter App');
      const count = ref(0);
      const doubled = computed(() => count.value * 2);
      const increment = () => count.value++;
      const reset = () => (count.value = 0);

      return { title, count, doubled, increment, reset };
    };
  </script>
</template>
```

### 6.2 Reusable component with props, events and shadow DOM

```html
<template component="ui-card" shadow-dom="open">
  <div class="card">
    <span class="card-title">{{ title }}</span>
    <slot></slot>
    <button on-click="select()">Select</button>
  </div>

  <script setup>
    import { defineProp, defineEvent } from '@li3/web';

    export default function () {
      const title = defineProp('title', { default: '' });
      const onSelect = defineEvent('select');

      const select = () => onSelect(title.value);

      return { title, select };
    };
  </script>

  <style>
    .card { padding: 1rem; margin: 1rem auto; border-radius: 0.5rem; border: 1px solid #ccc; }
    .card-title { color: #999; text-transform: uppercase; font-size: 0.75rem; }
  </style>
</template>

<ui-card title="First card" on-select="onCardSelect($event)">
  <p>Card content</p>
</ui-card>
```

### 6.3 Lifecycle + props: `count-trigger`

```html
<template component="count-trigger">
  <div>
    Ready? {{ ready }}<br />
    Update count: {{ count }}
  </div>

  <script setup>
    import { onInit, onUpdate, ref, defineProp } from '@li3/web';

    export default function () {
      const trigger = defineProp('trigger');
      const ready = ref(false);
      const count = ref(0);

      onInit(() => (ready.value = true));
      onUpdate(() => count.value++);

      return { trigger, ready, count };
    };
  </script>
</template>

<count-trigger bind-trigger="0" on-click="$event.target.trigger++"></count-trigger>
```

### 6.4 A todo list (loops, class bindings, two-way-ish input)

```html
<template app>
  <form on-submit.prevent="add()">
    <input ref="draft" attr-placeholder="'What needs to be done?'" />
    <button attr-disabled.bool="!draft.value.trim()">Add</button>
  </form>

  <p>{{ remaining }} of {{ todos.length }} remaining</p>

  <ul>
    <template for="[todo, i] of todos">
      <li class-done="todo.done">
        <span on-click="toggle(todo)">{{ i + 1 }}. {{ todo.title }}</span>
        <button on-click="remove(todo)">x</button>
      </li>
    </template>
  </ul>

  <template if="!todos.length">
    <p>Nothing to do. 🎉</p>
  </template>

  <script setup>
    import { ref, computed, templateRef } from '@li3/web';

    export default function () {
      const draft = templateRef('draft');
      const todos = ref([
        { title: 'Learn Lithium', done: true },
        { title: 'Build an app', done: false },
      ]);
      const remaining = computed(() => todos.value.filter((t) => !t.done).length);

      function add() {
        todos.value.push({ title: draft.value.value.trim(), done: false });
        draft.value.value = '';
      }
      const toggle = (todo) => (todo.done = !todo.done);
      const remove = (todo) => (todos.value = todos.value.filter((t) => t !== todo));

      return { draft, todos, remaining, add, toggle, remove };
    };
  </script>
</template>
```

Note the patterns: array mutations (`todos.value.push(...)`) and nested object mutations
(`todo.done = ...`) are reactive; replacing the array (`todos.value = filtered`) also works.

### 6.5 Script-less app with `<ref>` and `<script state>`

```html
<template app>
  <ref name="count" value="0" setter="setCount"></ref>
  <script state type="application/json">
    { "concepts": ["interpolation", "events", "loops"] }
  </script>

  <button on-click="setCount(count + 1)">Count: {{ count }}</button>
  <ul>
    <template for="c of concepts">
      <li>{{ c }}</li>
    </template>
  </ul>
</template>
```

## 7. Reactivity in depth

All reactive primitives are **signals**: objects with a `.value` property (`type Signal<T> = { value: T }`).

### `ref(value, isShallow?)`

Creates a writable signal.

```js
import { ref } from '@li3/web';

const count = ref(0);
count.value++;            // triggers updates
console.log(count.value); // 1
```

- **Deep by default**: object/array values are wrapped in a recursive reactive proxy, so nested
  mutations trigger updates: `user.value.name = 'Ada'`, `list.value.push(x)`.
- Setting `.value` skips notification when the new value compares equal to the old one
  (deep comparison for arrays/dates/regexps; see `compare`).
- Refs coerce via `Symbol.toPrimitive`: `count + 2` and `` `n=${count}` `` work without `.value`.

### `shallowRef(value)`

A ref without deep wrapping — nested mutations do **not** trigger updates; only replacing `.value` does.
`templateRef()` returns a shallow ref (so `input.value.value = 'x'` on an element ref isn't tracked,
which is what you want).

### `computed(fn)`

A read-only derived signal. Re-evaluates lazily when any signal read inside `fn` notifies.

```js
import { ref, computed } from '@li3/web';

const a = ref(1);
const b = ref(2);
const sum = computed(() => a.value + b.value);

sum.value;   // 3
a.value = 5;
sum.value;   // 7
sum.value = 9; // throws: "Computed value cannot be set"
```

Errors thrown inside `fn` are swallowed and yield `null` (logged when `debug` is on).

### `watch(signal, callback, options?)`

Calls `callback(newValue, lastValue)` whenever the signal changes. Returns an unsubscribe function.

```js
import { ref, watch } from '@li3/web';

const count = ref(0);
const unwatch = watch(count, (value, lastValue) => {
  console.log(`${lastValue} -> ${value}`);
});

count.value = 1; // logs "0 -> 1"
unwatch();       // stop watching
```

- The **first invocation is scheduled asynchronously** (~5ms queue) unless `{ immediate: true }` is
  passed, in which case it fires synchronously with the current value.

### `effect(fn, effectFn, options?)`

`effect(fn, effectFn)` is `watch(computed(fn), effectFn)`: `fn` computes a tracked value; whenever it
changes, `effectFn(newValue, lastValue)` runs. All DOM bindings are built on this.

```js
import { ref, effect } from '@li3/web';

const user = ref({ name: 'Ada' });
effect(
  () => user.value.name.toUpperCase(),
  (name) => console.log('name changed:', name),
);
user.value.name = 'Grace'; // logs "name changed: GRACE"
```

### `hook(initialValue, isShallow?)`

React-style tuple:

```js
import { hook } from '@li3/web';

const [count, setCount] = hook(0);
setCount(42);
console.log(count.value); // 42
```

### `reactive(object, effectFn)`

Creates a deep reactive proxy of `object` that calls `effectFn` on any change (set or delete, at any
depth). Non-objects and already-reactive objects pass through unchanged.

```js
import { reactive } from '@li3/web';

const state = reactive({ user: { name: 'Ada' }, items: [] }, () => console.log('changed'));
state.user.name = 'Grace'; // logs "changed"
state.items.push(1);       // logs "changed"
```

### `unwrap(object)`

Returns the raw value: the inner object for `reactive` proxies, `.value` for refs/computed, otherwise
the input unchanged. `null`/`undefined` pass through.

### `isRef(x)`, `isReadOnlyRef(x)`, `isWritableRef(x)`

Type guards. `computed` results are read-only; `ref` results are writable.

### `suspend(signal)` / `resume(signal)`

Suspend a signal: writes to `.value` become no-ops and its dependencies are dropped. `resume` clears
the flag and forces a re-update. Used internally to freeze rows removed by `<template for>`.

### `canBeObserved(object)`

True for plain objects that are not already reactive proxies. Internal use.

### Timing

- Signal notification is **synchronous** to dependents (computed re-evaluation).
- `watch`/`effect` **first** callbacks are queued (~5ms `setTimeout`, trailing); subsequent
  notifications run synchronously. All DOM updates from bindings flow through this, so DOM reflects
  state changes asynchronously — don't assert on the DOM synchronously after a state change.

## 8. Props

`defineProp(name, options?)` declares an input. Call it in setup; it returns a writable ref and also
exposes the prop in the template context by name.

```js
import { defineProp } from '@li3/web';

export default function () {
  const title = defineProp('title', { default: 'Untitled' });
  const items = defineProp('items', { default: () => [] });
  const active = defineProp('active', { default: false, attribute: true });

  return { title, items, active };
}
```

Options (`PropOptions`):

- `default?: T | (() => T)` — used when neither the element property nor attribute is set. A function
  is invoked (use it for object/array defaults).
- `attribute?: boolean` — when true, setting the prop reflects it back to the HTML attribute
  (`setAttribute(name, String(value))`).

**Initial value resolution**, in order:

1. The element **property** if already set (`el.title = 'Hi'` before connection).
2. The element **attribute**, parsed smartly: `'true'`/`'false'` → boolean, JSON/JS expressions and
   numbers evaluated (`value='[1,2,3]'` → array), anything else → string.
3. The `default`.

**Setting props from a parent** — use `bind-*` (property assignment) so any value type works:

```html
<user-list bind-users="allUsers" bind-page-size="25"></user-list>
```

- Setting `el.prop = value` (which `bind-*` does) updates the ref, fires `onUpdate` hooks
  (debounced 1ms), and reflects to the attribute when `attribute: true`.
- Plain attributes (`<user-list page-size="25">`) only initialize the prop; attribute changes after
  mount are **not** observed.
- Prop refs are writable inside the component (`title.value = 'x'`), which also updates
  `el.title`.

## 9. Events between components

`defineEvent(name)` declares an output and returns an emitter function. Call it with a payload:

```js
import { defineEvent, ref } from '@li3/web';

export default function () {
  const onSave = defineEvent('save');
  const draft = ref('');

  const save = () => onSave(draft.value); // emits CustomEvent('save', { detail: draft.value })

  return { draft, save };
}
```

Parent listens with the standard event binding; the payload is in `$event.detail`:

```html
<editor-pane on-save="handleSave($event)"></editor-pane>
```

```js
function handleSave(e) {
  console.log('saved:', e.detail);
}
```

- Emitted events are `CustomEvent`s on the host element. They do **not** bubble (`bubbles`/`composed`
  are not set), so listeners must be on the element itself — exactly what `on-<name>` does.
- Setting a function property `element.on<name> = fn` also receives the event (native-style handler).
- From template expressions, use the injected `$$emit(name, value)` directly:
  `on-click="$$emit('close')"`.
- Convention: event names are lowercase, no dashes.

## 10. Lifecycle hooks

All lifecycle functions must be called **during setup** (they need the current component context and
throw `"Missing context for this component"` otherwise).

```js
import { onInit, onUpdate, onDestroy, getElement } from '@li3/web';

export default function () {
  onInit(() => {
    // DOM is in place; good for focus(), measurements, starting timers
    getElement().querySelector('input')?.focus();
  });

  onUpdate(() => {
    // one or more props changed (debounced ~1ms)
  });

  onDestroy(() => {
    // element disconnected / unmounted; clear timers, abort requests
  });

  return {};
}
```

- `getElement()` returns the component's host element (also only during setup).

## 11. Loading components at runtime: `load`

`load(href, baseUrl?)` fetches an HTML file, registers every `<template component="...">` in it, and
resolves to the list of definitions. Relative URLs inside the file (setup `src`, stylesheets, nested
`<link rel="component">`) resolve against the file URL. Results are cached per resolved URL; failures
log to the console and resolve to `[]`.

```js
import { load } from '@li3/web';

await load('./components/ui-kit.html');
// <ui-card> etc. are now defined and upgrade automatically
```

**Component file format** — a complete example:

```html
<!-- ui-kit.html -->
<template component="ui-badge">
  <ref name="kind" value="'info'"></ref>
  <span class-badge="true" class-info="kind === 'info'" class-warn="kind === 'warn'">
    <slot></slot>
  </span>
  <style>
    .badge { padding: 0.25rem 0.5rem; border-radius: 1rem; }
    .info { background: #def; }
    .warn { background: #fed; }
  </style>
</template>

<template component="ui-card" shadow-dom="open">
  <link rel="component" href="./ui-avatar.html" />
  <link rel="stylesheet" href="./ui-card.css" />

  <div class="card">
    <ui-avatar bind-user="author"></ui-avatar>
    <h3>{{ title }}</h3>
    <slot></slot>
  </div>

  <script setup>
    import { defineProp, defineEvent } from '@li3/web';
    export default function () {
      defineProp('title', { default: '' });
      defineProp('author', { default: null });
      const onOpen = defineEvent('open');
      return { onOpen };
    };
  </script>
</template>
```

## 12. Programmatic mounting: `mount`

`mount(targetElement, options)` mounts a component onto an existing element and returns an unmount
function. Options (`MountOptions`):

```ts
{
  template: HTMLTemplateElement | string; // a <template> or an HTML string
  setup?: () => object;                   // the setup function
  styles?: CSSStyleSheet[];               // adopted into shadowRoot or document
  shadowDom?: boolean | ShadowRootInit;   // true = { mode: 'open' }
  refs?: [name, value, setterName][];     // declarative refs
}
```

```js
import { mount, ref } from '@li3/web';

const unmount = mount(document.getElementById('app'), {
  template: `<p>{{ message }}</p><button on-click="increment()">{{ count }}</button>`,
  setup() {
    const message = ref('Hello');
    const count = ref(0);
    const increment = () => count.value++;
    return { message, count, increment };
  },
});

// later: unmount();
```

`defineComponent(name, options)` registers a custom element class with the same options. Note it is
part of the component module but **not re-exported from the package entry point** — prefer
`<template component>` / `load()` for HTML-driven apps, and `mount()` for programmatic ones.

`autoInitialize()` runs the startup pass manually (define in-document `template[component]`, load
`link[rel=component]`, mount `template[app]`). It runs automatically unless the `skipAutoInitialize`
flag is set.

## 13. The extension system: `use`

All template syntax is implemented as **rules**, and you can add your own:

```ts
use({
  match(node: Element, attribute: string, value: string): boolean,
  exec(node: Element, attribute: string, value: string, context: any): void,
});
```

- For every attribute of every element, rules are tried **in registration order**; the first match
  runs `exec`, and the attribute is removed from the DOM.
- Built-in rules (also exported, so you can subclass them): `TemplateIf`, `TemplateFor`,
  `AddEventListener`, `SetProperty`, `SetAttribute`, `SetClassName`, `SetStyle`.
- `context` is the read-only template context. Expressions are compiled with the internal
  `createFunction(expression, context, args)`; wire reactivity with `effect`/`watch`.

Example — a custom tooltip directive:

```js
import { use, effect } from '@li3/web';

use({
  match: (node, name) => name === 'tooltip',
  exec: (node, name, value, context) => {
    // naive implementation: evaluate `value` against context and keep title in sync
    const fn = new Function(`with(this) { return ${value}; }`).bind(context);
    effect(fn, (v) => node.setAttribute('title', v ?? ''));
  },
});
```

```html
<span tooltip="user.fullName">hover me</span>
```

Example — Vue-style syntax (this is how the sibling `@li3/use` package implements `useVue()`):
subclass the built-ins and remap attribute names:

```js
import { use, TemplateFor, TemplateIf, SetProperty, AddEventListener } from '@li3/web';

class VueSetProperty extends SetProperty {
  match(node, name) { return name.startsWith(':'); }
  exec(node, name, value, context) {
    return super.exec(node, 'bind-' + name.slice(1), value, context);
  }
}

class VueEventListener extends AddEventListener {
  match(node, name) { return name.startsWith('@'); }
  exec(node, name, value, context) {
    return super.exec(node, 'on-' + name.slice(1), value, context);
  }
}

class VueTemplateIf extends TemplateIf {
  match(node, name) { return name === 'v-if'; }
  exec(node, name, value, context) {
    const t = document.createElement('template');
    node.replaceWith(t);
    node.removeAttribute('v-if');
    t.content.append(node);
    super.exec(t, 'if', value, context);
  }
}

class VueTemplateFor extends TemplateFor {
  match(node, name) { return name === 'v-for'; }
  exec(node, name, value, context) {
    const t = document.createElement('template');
    node.replaceWith(t);
    node.removeAttribute('v-for');
    t.content.append(node);
    super.exec(t, 'for', value, context);
  }
}

use(new VueSetProperty());
use(new VueEventListener());
use(new VueTemplateIf());
use(new VueTemplateFor());
```

This enables `:value="x"`, `@click="fn()"`, `v-if="cond"`, `v-for="item of items"` on any element.

## 14. Feature flags and debugging

Set flags via `setFeatureFlag(name, value?)` (must run before components initialize) or by listing them
comma-separated in `window.name` (e.g. `window.name = 'debug,linker'` — note this replaces the window
name).

| Flag | Effect |
|---|---|
| `debug` | Keeps processed binding attributes on elements; keeps `<template app>` elements in the DOM; attaches every signal to `window.refList` (a `Set` of `WeakRef`s); logs component redefinition and computed errors. |
| `linker` | Pre-compiles template rule matches once per template and replays them per mount (faster mounts for repeated components). |
| `strictCompare` | Uses `===` instead of the deep-ish `compare` for change detection. |
| `skipAutoInitialize` | Disables the automatic startup pass; call `autoInitialize()` yourself. |

Debugging aids:

- Every mounted root element carries its merged context under a symbol key; with `debug` on, processed
  attributes stay visible in devtools, and `window.refList` lets you inspect live signals.
- Set `window.name` to `debug` in any page to attach component context to components.
- `<template if>` / `<template for>` leave comment anchors (`<!--if: ...-->`, `<!--for: ...-->`) in
  the DOM, which helps trace conditional/list regions in devtools.

## 15. Complete syntax cheat sheet

| Feature | Syntax | Example |
|---|---|---|
| Interpolation | `{{ expr }}` in text nodes | `<p>{{ user.name }}</p>` |
| Event | `on-<event>="expr"` | `<button on-click="save()">` |
| Event modifiers | `.stop` `.prevent` `.self` | `<form on-submit.prevent="save()">` |
| Event payload | `$event` (`$event.detail` for custom events) | `on-input="onInput($event)"` |
| Property binding | `bind-<prop>="expr"` (camelCased) | `<input bind-value="name">` |
| Boolean property | `bind-<prop>.bool="expr"` | `<button bind-disabled.bool="busy">` |
| Class map | `bind-class="{ cls: cond }"` | `<div bind-class="{ active: isOn }">` |
| Style map | `bind-style="{ prop: value }"` | `<div bind-style="{ color: c }">` |
| Attribute binding | `attr-<name>="expr"` | `<div attr-data-id="id">` |
| Boolean attribute | `attr-<name>.bool="expr"` | `<input attr-readonly.bool="locked">` |
| Class toggle | `class-<name>[.<name2>]="expr"` | `<li class-done="t.done">` |
| Style property | `style-<prop>="expr"` (camelCased) | `<div style-color="c">` |
| Conditional | `<template if="expr">` | `<template if="user">...</template>` |
| List | `<template for="item of items">` | `<template for="u of users">...</template>` |
| List + index | `<template for="[item, i] of items">` | `<template for="[u, i] of users">...</template>` |
| Element ref | `ref="name"` + `templateRef('name')` | `<input ref="box">` |
| Declarative state | `<ref name value setter>` inside template | `<ref name="n" value="0" setter="setN">` |
| JSON state | `<script state type="application/json">` | `{ "title": "Hi" }` |
| Setup module | `<script setup>` (or `src=`) | `export default function () { ... }` |
| Component | `<template component="my-el" shadow-dom="open">` | custom element definition |
| App root | `<template app>` | auto-mounted |
| Styles | `<style>` / `<link rel="stylesheet">` inside template | adopted stylesheets |
| Dependencies | `<link rel="component" href="...">` | page or template level |
| Emit from template | `$$emit('name', value)` | `on-click="$$emit('close')"` |
| Skip subtree | `do-not-render` attribute | `<pre do-not-render>` |
| Custom rule | `use({ match, exec })` | see [§13](#13-the-extension-system-use) |
| Feature flags | `setFeatureFlag('debug')` / `window.name` | see [§14](#14-feature-flags-and-debugging) |

## 16. Gotchas and rules of thumb

1. **Return your bindings.** The setup function's returned object is the template context. No `return`
   → empty context → bindings silently do nothing.
2. **Templates are read-only.** `on-click="count++"` throws. Expose methods (`increment()`) and call
   them. Object internals may be mutated (`user.name = x`).
3. **`for` uses `of`**, not `in`. There is no keying; rows are reused by index and their item values
   updated in place.
4. **No `else`.** Use complementary `<template if>` conditions or computed flags.
5. **DOM updates are async.** Bindings flush on a ~5ms queue; `if`/`for` insertions happen on a
   timeout. Read the DOM after a `setTimeout`/`await new Promise(r => setTimeout(r))` if needed.
6. **Custom events don't bubble.** Listen with `on-<name>` directly on the child element tag.
7. **Attributes initialize props; properties drive them.** After mount, set props via properties
   (`bind-*` / `el.prop = v`); attribute changes are not observed.
8. **One rule per attribute**, first match wins. Rule prefixes: `on-`, `bind-`, `attr-`, `class-`,
   `style-`; `if`/`for` only on `<template>`.
9. **Binding attributes are stripped** after processing (visible with the `debug` flag).
10. **Component names need a dash** and must not be SVG-reserved names (`font-face`, etc.).
11. **`load()` caches per URL** and resolves to `[]` on failure (check the console).
12. **Refs auto-unwrap in templates**, but in setup code always use `.value` (except in coercions,
    where `Symbol.toPrimitive` applies).
13. **`<slot>` requires shadow DOM** (`shadow-dom="open"`); there is no light-DOM slot polyfill.
14. **Boolean attributes need `.bool`** (`attr-disabled.bool="x"` or `bind-hidden.bool="x"`); plain
    `attr-disabled="false"` sets the string `"false"`, which is still truthy as an attribute presence.
15. **Setup-side helpers require setup context**: `defineProp`, `defineEvent`, `templateRef`,
    `onInit`, `onUpdate`, `onDestroy`, `getElement`, `loadCss` (with adoption) throw outside a running
    setup function.
