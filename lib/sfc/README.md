# @lithium/sfc

## Usage

```js
import { parseSFC } from '@lithium/sfc';

const sfc = parseSFC('<template><div>hello!</div></template>');
const code = getComponentCode('hello-world', sfc);

```

## Single-file components

A single-file component has 2 required parts: a `template` and a `script`. Optionally, it can have a `style` tag.

## `<template>`

A `template` can define options for [ShadowDOM](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow).
`shadow-dom` can either be a string or a JSON. For simplicity, `open` or `closed` are accepted as strings.
Otherwise, an object with options passed to `attachShadow` can also be provided.

If no shadow-dom attribute is provided, the component behaves like a regular DOM structure, with the content of `<template>` processed
and appended to the custom-element root node.

## `<script>`

A `script` tag defines the code executed for every component instance.
The content inside the script tag is _implicitly_ wrapped by a function, which is then executed every time a new instance of a component
is initialized.

## `<style>`

A `style` tag can be defined with styles that will be added to every component instance.

```html
<template shadow-dom="open">
  <div class="hello">Hello, {{ name }}!</div>
</template>

<script>
  import { defineProps } from '@lithium/web';
  defineProps(['name']);
</script>

<style>
  .hello { font-size: 3rem; }
</style>
```
