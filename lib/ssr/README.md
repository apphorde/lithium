# @li3/ssr

Server-side rendering for `@li3/web` applications. It accepts a complete HTML page, creates a virtual
server DOM with `jsdom`, runs the normal Lithium template/component runtime, waits for reactive bindings
to settle, and returns serialized HTML.

## Install

```sh
pnpm add @li3/ssr @li3/web
```

## Basic usage

The Node server owns routing and page loading. `@li3/ssr` is the HTML-in/HTML-out rendering step:

```js
import { readFile } from 'node:fs/promises';
import { renderPage } from '@li3/ssr';

const page = await readFile('./pages/home.html', 'utf8');
const { html } = await renderPage({
  html: page,
  url: 'https://example.com/home',
});

res.type('html').send(html);
```

The input page can contain every `@li3/web` feature: interpolations, events, properties, attributes,
classes, styles, `<template if>`, `<template for>`, `<template component>`, and `<template app>`.

## Example page

```html
<!doctype html>
<html>
  <head><title>Counter</title></head>
  <body>
    <template app>
      <h1>{{ title }}</h1>
      <p>Count: {{ count }}</p>

      <template if="count > 0">
        <p>You have clicked {{ count }} times.</p>
      </template>

      <ul>
        <template for="item of items">
          <li>{{ item }}</li>
        </template>
      </ul>

      <button on-click="increment()">Increment</button>

      <script setup>
        import { ref } from '@li3/web';

        export default function () {
          const title = ref('Server-rendered counter');
          const count = ref(0);
          const items = ref(['first', 'second']);
          const increment = () => count.value++;

          return { title, count, items, increment };
        }
      </script>
    </template>
  </body>
</html>
```

The returned HTML contains the rendered heading, count, conditional paragraph, and list rows before the
browser loads JavaScript.

## Render options

```ts
type RenderOptions = {
  html: string;
  url?: string;
  components?: string[];
  settle?: number;
  hydrate?: 'hydrate' | 'static' | 'none';
  state?: Record<string, unknown>[];
};
```

- `html` is the complete page source.
- `url` defaults to `http://localhost/` and is used to resolve relative component/setup/style URLs.
- `components` optionally lists component HTML files to load before rendering. Each URL is resolved
  relative to `url`.
- `settle` adds a delay after Lithium's normal reactive flush. Use it when setup code starts asynchronous
  work that must affect the initial response. It defaults to `0`; the renderer always waits for the normal
  binding and `if`/`for` timers.
- `state` overrides automatic state collection and supplies snapshots to embed in the output.
- `hydrate` controls the returned page:
  - `hydrate` (default) keeps the source templates, marks app projection roots, embeds state, and adds a
    small module bootstrap. The browser re-renders into the existing projection roots without creating
    duplicate app containers.
  - `static` removes component/app source templates and root markers. Use this for a no-JavaScript static
    response.
  - `none` keeps the source templates but adds no bootstrap. Only use this when application code owns the
    client boot process.

## Hydration contract

Lithium's current client runtime does **not** reconcile server-rendered text, attributes, `if` blocks, or
`for` rows. The server and client both execute the templates:

1. The server executes all bindings, including `if` and `for`, so the initial HTML is complete.
2. The server leaves the `<template app>` source available as the client's rendering blueprint.
3. The server marks the generated projection div with `data-li3-root`.
4. The browser's SSR bootstrap enables the `ssr` feature flag. `findApps()` reuses that projection div,
   then `mount()` clears and renders its contents again from the source template.

This is intentional. `if`/`for` rows contain live sub-contexts created during the server render, so trying
to infer and adopt them would be unreliable. They are rendered on the server for first paint and rebuilt
client-side for live bindings. Only the empty projection container is adopted, preventing duplicate app
roots.

## State snapshots

In hydrate mode, each app gets a JSON snapshot:

```html
<script type="application/json" data-li3-ssr="0">
  {"title":"Server-rendered counter","count":0,"items":["first","second"]}
</script>
```

`renderPage()` also returns these snapshots as `result.state`. Signals are unwrapped; functions, internal
framework values, and DOM nodes are omitted. Use `serializeState()` and `readState()` for low-level access:

```js
import { readState } from '@li3/ssr';

const snapshots = readState(document);
```

State is embedded safely: closing script sequences are escaped before insertion into JSON script tags.

The current `@li3/web` setup API does not automatically consume `data-li3-ssr` snapshots. Setup code must
remain deterministic or explicitly read state supplied by the application. The snapshot is available for
application bootstrapping and future hydration improvements.

## Components

Components declared in the input page are registered and rendered normally:

```html
<template component="user-card">
  <article>
    <h2>{{ name }}</h2>
  </article>

  <script setup>
    import { defineProp } from '@li3/web';
    export default function () {
      return { name: defineProp('name', { default: 'Anonymous' }) };
    }
  </script>
</template>

<template app>
  <user-card name="Ada"></user-card>
</template>
```

Use `components` when component templates are stored in separate HTML files:

```js
await renderPage({
  html: await readFile('./pages/home.html', 'utf8'),
  url: 'https://example.com/home',
  components: ['./components/ui-kit.html'],
});
```

`<link rel="component" href="./components/ui-kit.html">` in the page also works through the regular
`@li3/web` loader.

## Virtual DOM API

Use `createDom()` when integrating the runtime manually:

```js
import { createDom } from '@li3/ssr';

const virtual = createDom('<!doctype html><html><body></body></html>');
try {
  // @li3/web APIs can run here against virtual.document.
  console.log(virtual.document.body.innerHTML);
} finally {
  virtual.restore();
}
```

`withDom(html, url, callback)` performs the same setup and always restores Node globals:

```js
import { withDom } from '@li3/ssr';

await withDom(page, 'https://example.com/', async ({ document }) => {
  // work with the virtual document
});
```

Always restore the virtual DOM when using `createDom()` directly. The renderer does this automatically
after serializing the result.

## Output modes

### Hydrated HTML (default)

Use for interactive pages. The output includes:

- server-rendered app content,
- `data-li3-root` on each app projection div,
- serialized app state,
- a module script that enables SSR root adoption and starts `autoInitialize()`.

### Static HTML

```js
const { html } = await renderPage({ html: page, hydrate: 'static' });
```

The output contains server-rendered content but no Lithium source templates or SSR root markers. It is
appropriate for pages that do not need client interactivity.

## Async setup

Setup functions are called by the existing `@li3/web` runtime. The renderer waits for its normal reactive
queue and structural rendering timers. If setup code needs additional time to update state, specify a
settling delay:

```js
await renderPage({
  html: page,
  settle: 100,
});
```

For request-specific data, prefer resolving data in the Node server before creating the page, then place
it in `<script state type="application/json">` or generate it in the setup module.

## Exports

```ts
createDom(html?, url?)
withDom(html, url, callback)
renderPage(options)
collectState(document)
embedState(document, states)
readState(document)
serializeState(state)
snapshotOrDefault(snapshots, index, key, fallback)
findAppRoots(document)
importModuleFromFile(sourceText, origin?)
```

## Limitations in v0.1.0

- Rendering uses `jsdom`; it is intended for Node servers, not browser bundles.
- Server rendering and client startup both evaluate bindings. There is no DOM diff/hydration algorithm yet.
- `if` and `for` rows are rebuilt on the client; their server DOM is not adopted.
- Setup modules are imported from temporary files on the server. Bare `@li3/web` imports are rewritten to
  the installed package entry so setup modules share the server runtime.
- CSS stylesheets are not adopted into the virtual DOM. CSS can still be emitted or handled by the server's
  normal asset pipeline.
- Multiple concurrent render requests should use isolated render workers or a request-safe runtime until
  the global virtual-DOM installation is replaced with an async-local context.
