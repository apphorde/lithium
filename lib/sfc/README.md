# @li3/sfc

Transform a single-file component into a component definition, or into an executable ES module with a custom element.

## Usage

```js
import { parseSFC, getComponentCode } from "@li3/sfc";

const sfc = parseSFC("<template><div>hello!</div></template>");
const code = getComponentCode("hello-world", sfc);
```

## Single-file components

A single-file component has usually two parts: a `template` and a `script`. Optionally, it can also have a `style` tag.

## `<template>`

A `template` can define options for [ShadowDOM](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow).
`shadow-dom` can either be a string or a JSON. For simplicity, `open` or `closed` are accepted as strings.
Otherwise, a JSON object with the same options passed to `element.attachShadow()` can also be provided.

If no shadow-dom attribute is provided, the component behaves like a regular DOM structure, with the content of `<template>` processed
and appended to the custom element's root node.

## `<script>`

A `script` tag defines the code executed for every component instance.
The content inside the script tag is _implicitly_ wrapped by a function, which is then executed every time a new instance of a component
is initialized.

If a component has any `import` or `export` statement, any code between the _last_ import and the _first_ export is considered as setup code. Because export statements can use values that would be part of the source, in case a component needs to export values, a `setup` function **must** be defined, and called `defineComponent`. The conversion will fail otherwise.

## `<style>`

A `style` tag can be defined with styles that will be added to every component instance.

## Examples

A component with only setup code:

```html
<script>
  import { onInit } from "@li3/web";

  function componentLoaded() {
    // do something
  }

  onInit(componentLoaded);
</script>
```

A component with a template using shadowDom, a script and styles:

```html
<template shadow-dom="open">
  <div class="hello">Hello, {{ name }}!</div>
</template>

<script>
  import { defineProps } from "@li3/web";
  defineProps(["name"]);
</script>

<style>
  .hello {
    font-size: 3rem;
  }
</style>
```

A component that has only a template:

```html
<template shadow-dom="open">
  <div>A static text with a tiny font size</div>
</template>
<style>
  div {
    font-size: 0.25rem;
  }
</style>
```

A component with imports and exports:

```html
<template>
  <div>{{color}}</div>
</template>
<script>
  import { defineProps } from "@li3/web";

  const validColors = ["red", "blue", "green"];

  function defineComponent() {
    defineProps(["color"]);
  }

  export { validColors };
</script>
```
