# Introduction

Lithium (Li³) is a lightweight component library to create custom elements using standard Web API's (as much as possible).

We stick to the Web API's implemented in baseline browsers and platforms.

The syntax is inspired in frameworks like VueJS, Alpine and Solid, but reduced to something closer to HTML.

Starting from only HTML, we can progressively shape an interface, expanding on content already in-place. This gives us a "server-side rendering" capability without special tools (aka Progressive Enhancement).

## Importing the library

We use two `ES Module` features to load li3 and it's sub-modules: [**import map**](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) and [**module script type**](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#applying_the_module_to_your_html)

The import map allows us load `@li3/\*` packages using a package name. This _has to be the first_ `<script>` tag in a page.

```html
<script type="importmap">
  { "imports": { "@li3/": "https://cdn.li3.dev/@li3/" } }
</script>
```

Next, this script tag loads the main library and initializes all components and apps. And no, changing to `src="@li3/web"` does not work.

```html
<script type="module">
  import '@li3/web';
</script>
```

---

## Declare Your Web Components

Declaring components are not exactly a _new_ thing. It's just a way for us to agree on a _convention_ to declare what we want from a custom element, using API's that modern platforms already offer:

- [HTMLTemplateElement](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template)
- [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [ShadowDOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [CSSStyleSheet](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet)

Different libraries or frameworks have tried to solve the same problem. In multiple ways. We want to find a the "special ways" of doing things, and go back to simple and easy concepts.

Before we dig in: this is not a criticism of all the awesome work put behind big frameworks and libraries out there.
Everyone is doing their absolute best to solve a difficult problem!

So let's see a few examples:

## The cases of too much abstraction

Everything in life has trade-offs. That's always the case, and web apps are no different.

What we chose to do here is to skip build steps entirely, and rely on the browser API's alone to parse and activate bindings on a static HTML content.

### VueJS Syntax

Vue uses single-file components concept, with an HTML-like syntax.

The "special things" that Vue adds are the `:` and `@` characters in attribute names, which are not valid in HTML attributes.
There are also "special" attributes like `v-if` and `v-for`, which are a way to put an entire element behind a template and add logic to define their visibility.

Sure, they are shorter, and we could use them if we like (more on that later)
Then we have the `#` character for template slots, which is also not valid HTML.

### Angular Syntax

Angular uses [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes) and [Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html), and also adds special `[]`, `()` and `[()]` attributes (or was it `([])`??). Angular was a great step towards declarative API's, but no thanks.

### React Syntax

Where to I begin?

React made [JSX](https://react.dev/learn/writing-markup-with-jsx) famous and added more specific syntax as well.
Events are inline "things", with special brackets around values and all that. I could never really memorize all that.

### Alpine or HTMX?

These add again very specific syntax to their mental model, which is not easy to remember.

From their docs: `Alpine is a collection of 15 attributes, 6 properties, and 2 methods.`

## Can we agree upon a simpler model?

Yes, there are 14 standards, and we want to unify them all!
Situation: now there are 15 standards.

OK, but we can at least choose a _predictable_ mental model instead of the specifics of each library.

Here's the model we propose:

**Props down:**

We need Javascript "values". Properties are more than just strings, and HTML is string-only.
We also need to scope values to something smaller than the global scope. So we need values, a context and expressions to "bind" them together.
Here's where `bind-*="..."` comes from.

**Events up:**
We only communicate with the world via _events_. All events in the DOM model are lowercase. We just need an expression to run when they fire.
We probably want this expression to also be in context. So `on-*="..."` is our next mental model.

**signal => reaction:**

- We need a predictable state model. And we want to react only to the things that have changed.
  A `Signal` represents that. With a signal, we can apply fine-grained updates to elements, which are fast and efficient

So let's agree on some principles:

1. Data flow is predictable: only `props` down and only `events` up.
2. The only way a component can change from the _outside_ is with a change to its properties.
3. Any change _inside_ a component is propagated up as an event. Internal changes _can_ also mutate component's properties.
4. any string in a property binding or event handler is valid Javascript and **local** to the current context, **never global**

So let's add some life to HTML:

```html
<custom-element on-action="reaction()" bind-name="value"></custom-element>
```

We still need to sprinkle some Javascript into our component to make it useful.
Let's look at other Web API's we can use to expand our component convention.

## Web API's we can use today

We have quite a few things to put together before we can fully use the web platform. Here are some of the API's we can explore:

- Custom Elements Registry
- Templates and Slots
- ES Modules
- adopted CSS Stylesheets
- Import Maps
- Abort Controllers
- Shadow DOM and ElementInternals
- CSS parts selector

We will also build on top of concepts previously popularized by projects like Angular, VueJS, SolidJS and React.

- Ref
- data binding
- props
- API Composition
- Functional components
- Redux/Store pattern

## Narrow Down the Execution Context

Historically, a web page has a shared Javascript execution context, sometimes called "global scope", where all parts of a page must coexist. When pages were _mostly_ text, with barely any Javascript, this was okay.

But the Web evolved, and with it, more complex structures started to emerge.
It became harder and harder to maintain with a global context.

We need _something_ in a page to create local variables, declare local event handlers, load modules and manage state.
We should also _compose_ with pieces of logic anda data without assigning values to the `window` object.

Another problem area is styling: we don't want global styles applied everywhere. Sometimes styles must be scoped to a single component.

[Custom Elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) are one of the building blocks we need to achieve just that.
We declare a custom `<any-name>` tag and let the platform initialize it for us. Inside that context, we can import modules, load stylesheets and run our business completely isolated from the global state.

## Declaring Components In HTML

The [`<template>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template) provides an API to include HTML in a webpage without rendering it.

This is very useful for us: we can load components just like any other HTML content, then read their content and "hydrate" the HTML with the help of Javascript, of course.

From a `template` element we use `.contents.cloneNode()` API to clone the entire template content without modifying the original nodes.

Another important aspect of templates is that scripts and styles **are not active**.
We can include a `<script>` tag inside a template and use that as our component source.
That's possible because of [modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

### Using `<script setup>` and `<template component>` attribute

OK, now that we agreed upon attributes for components, let's add TWO other convetions:

> 1. add a `component` attribute to a `<template>` to create a custom element with a name

```html
<template component="ui-card">~</template>
```

> 2. add a `<script>` tag inside that template to declare the component behaviour

Now, a component can be authored in plain HTML, and even inserted into a webpage directly into the source.

> This is also not new. We can also use a [Declarative Shadow DOM](https://web.dev/articles/declarative-shadow-dom) to achieve that.
> In that case, we don't reuse anything, and all content is inline.

Here's what we introduce _on top of the standard API_:

- optionally, add `shadow-dom` attribute to specify [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) API options.

```html
<template component="ui-card" shadow-dom="open"></template>
```

- create a `<script setup>` tag to write the component logic.
  Use [import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#importing_features_into_your_script) to load `@li3/web` and export a setup function:

```html
<script setup>
  import { defineEvent, defineProp, signal, effect } from '@li3/web';
  export default function () {
    /* ... */
  }
</script>
```

## Summary

OK, let's take one step back and recap:

- `<template component>` for declarative component
- `<script setup>` for declarative component behaviour
- `<custom-element prop-* on-*>` for props and events with local scope.

Let's see all together in a `ui-card` component:

```html
<template component="ui-card" shadow-dom="open">
  <div class="card">
    <span class="card-title">{{ title }}</span>
    <slot></slot>
  </div>

  <script setup>
    import { defineProp } from '@li3/web';
    export default function uiCard() {
      defineProp('title', { default: '' });
    }
  </script>

  <style>
    .card {
      padding: 1rem;
      margin: 1rem auto;
      border-radius: 0.5rem;
      border: 1px solid #ccc;
      background-color: white;
    }
    .card-title {
      color: #999;
      text-transform: uppercase;
      font-size: 0.75rem;
      display: inline-block;
      padding: 0 0 1rem 0;
    }
  </style>
</template>
```

---

## The Component Setup API

## computed(fn)

A reference that is always computed on state checks. Takes a function and returns a ref that is auto-updated when scope checks are executed.

## ref(val) and shallowRef(val)

`ref` creates an object with a single property, `.value`, for which we can track changes.

Changes to any `ref` value inside a component scope trigger an update.

If the ref contains an object, any property change in that object also triggers an update (deeply checked).
An initial value can be given to it.

`shallowRef` is the mostly the same, with the difference that it will not deeply watch object changes in the ref value.

```ts
import { ref, shallowRef } from '@li3/web';

export default function setup() {
  const address = ref({ street: '', number: 0, zipCode: '' });
  const name = shallowRef('');

  return { name, address };
}
```

## defineEvent(name)

Defines a function that emits a custom event called by `name`. Use this function to emit a specific event in the template.

```ts
import { defineEvent } from '@li3/web';

export default function setup() {
  const onAction = defineEvent('update');
  // ...
  onAction('action');
}
```

## defineEvents(names)

A convenience method to define multiple events at once. The returned function emits events by name and accepts a second argument:

```ts
import { defineEvents } from '@li3/web';

export default function setup() {
  const emit = defineEvents(['one', 'two']);
  // ...
  emit('one', 1);
  emit('two', 2);
}
```

## defineProp(name, definitions)

Define an input property for a custom element.
The component scope is checked every time this property changes.

```ts
import { defineProp } from '@li3/web';

export default function setup() {
  const age = defineProp('age', 0);
}
```

## defineProps(names) / defineProps(table)

Define multiple props in one shot.

```ts
import { defineProps } from '@li3/web';

export default function setup() {
  const { left, right } = defineProps(['left', 'right']);
}
```

## defineQuery(selector)

Return a dynamic object that can either grab a list of child nodes (`.many`) or one child node (`.one`)

```ts
import { defineQuery } from '@li3/web';

export default function setup() {
  const listItems = defineQuery('li');
  // ...
  listItems.many.forEach((li) => {});
}
```

## inject(target) and provide(target, value)

An injection mechanism using DOM events. Use `provide(target, value)` to provide a value to child nodes of a custom element.

In a child node, use `inject(target)` to retrieve a value from parent nodes. The first parent to provide a value in the DOM tree wins.

```html
<template component="user-avatar">
  <div class="rounded-full w-16 h-16">
    <img prop-src="user?.avatar" class="w-full h-full" />
  </div>

  <script setup>
    import { inject, onInit, shallowRef } from '@li3/web';
    import { $user } from './auth.js';

    export default function setup() {
      const auth = shallowRef(null);
      onInit(() => {
        auth.value = inject($user);
      });
    }
  </script>
</template>

<template app>
  <script setup>
    import { provide, onInit } from '@li3/web';
    import { $user, login } from './auth.js';

    const currentUser = ref(null);
    provide($user, currentUser);

    onInit(async () => {
      currentUser.value = await login();
    });
  </script>
</template>
```

## loadCss(url)

Loads a CSS stylesheet from `url` and attaches to the element inside a Shadow Root, if present.
Otherwise, adds the stylesheet to `document.head` and shares it globally.

```js
import { loadCSS } from '@li3/web';

export default function () {
  const sheet = loadCss('https://example.com/shared-styles.css');
}
```

## loadScript(url)

Loads a JS file globally on document.head, as a tag.
The URL is loaded only once per page.

```js
import { loadScript } from '@li3/web';

export default function () {
  loadScript('https://example.com/shared-library.js');
}
```

## onInit(fn) / onUpdate(fn) / onDestroy(fn)

Lifecycle hooks for callbacks that run when a component first runs, when any prop changes or when the component is destroyed (in case of custom elements)

```js
import { onInit, onUpdate, onDestroy } from '@li3/web';

export default function () {
  onInit(() => {
    // init component
  });

  onUpdate(() => {
    // an input property has changed
  });

  onDestroy(() => {
    // clean up component state
  });
}
```

## hostClasses(classes)

Allows to declare CSS classes to be added to the custom element host.

```js
import { hostClasses } from '@li3/web';

export default function () {
  hostClasses('block my-6');
}
```

---

## Component lifecycle

These lifecycle events are executed for every custom element:

| Event       | Description                                                |
| ----------- | ---------------------------------------------------------- |
| `onInit`    | Called when a component is visible and ready               |
| `onUpdate`  | Called when a property has changed                         |
| `onDestroy` | Callend when a Custom Element is removed from the document |

## onInit, onUpdate, onDestroy

These hooks can be used inside setup functions or inside reusable code factories.

Example 1: `ready` triggers once, `count` triggers every time a prop changes.

```html
<template component="count-trigger">
  <div>
    Ready? {{ready}}<br />
    Update count: {{count}}
  </div>

  <script setup>
    import { onInit, ref, defineProp } from '@li3/web';

    export default function () {
      const trigger = defineProp('trigger');
      const ready = ref(false);
      const count = ref(0);

      onInit(function () {
        ready.value = true;
      });

      onUpdate(function () {
        count.value++;
      });
    }
  </script>
</template>

<count-trigger bind-trigger="0" on-click="$event.target.trigger++"></count-trigger>
```

Example 2: reusable code with hooks.

```html
<template component="app-scroller">
  <div>Scroll position: {{ scroll.y }}</div>

  <script setup>
    import { onInit, onDestroy, ref, debounce } from '@li3/web';

    // this could be moved to use-scroll.js
    export function useWindowScroll() {
      const ref = ref(0);
      const handler = debounce(handler(e) => ref.value = { x: window.scrollX, y: window.scrollY });

      onInit(() => window.addEventListener('scroll', handler));
      onDestroy(() => window.removeEventListener('scroll', handler));

      return ref;
    }

    export default function () {
      const scroll = useWindowScroll();
      return { scroll };
    }
  </script>
</template>

<template app>
  <app-scroller></app-scroller>
</template>
```

## mount(target, configuration)

Mounts a configuration into a target element.

This API can be used to programatically create DOM structures with the same semantics as a custom element. In fact, this is the same API called by a custom element create with Lithium.

`target` can be an element or [DocumentFragment](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment).
`configuration` is a component definition object, with any of:

- a `template` string or element
- a `setup` function
- a `shadowDom` configuration.
- `styles`: array of CSSStyleSheet
- ``

---

See https://mdbin.api.apphor.de/p/ae1979f7-b3d2-49d4-ad85-2b0b282b88a7
